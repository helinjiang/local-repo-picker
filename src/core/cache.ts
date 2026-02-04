import path from "node:path"
import { promises as fs } from "node:fs"
import pLimit from "p-limit"
import type { CacheData, CacheMetadata, RepoInfo, ScanOptions } from "./types"
import { scanRepos } from "./scan"
import { readManualTags, buildTags, getRemoteTag, uniqueTags } from "./tags"
import { isDirty, parseOriginInfo, readOriginUrl } from "./git"
import { readLru, sortByLru } from "./lru"
import { getConfigPaths } from "../config/config"
import { logger } from "./logger"
import { resolveTagExtensions } from "./plugins"
import { normalizeRepoKey } from "./path-utils"

const defaultTtlMs = 12 * 60 * 60 * 1000

export async function buildCache(
  options: ScanOptions,
  context?: { reason?: "initial" | "refresh" | "rebuild" }
): Promise<CacheData> {
  const normalized = normalizeOptions(options)
  const buildStartedAt = Date.now()
  const manualTags = await readManualTags(normalized.manualTagsFile)
  const scanStartedAt = Date.now()
  let warningCount = 0
  const warningSamples: string[] = []
  const found = await scanRepos({
    ...normalized,
    onWarning: (warning) => {
      warningCount += 1
      if (warningSamples.length < 5) {
        warningSamples.push(`${warning.reason}: ${warning.path}`)
      }
    }
  })
  const scanFinishedAt = Date.now()
  const scanDurationMs = scanFinishedAt - scanStartedAt
  logger.debug(
    `scan: ${found.length} repos, ${scanDurationMs}ms (${context?.reason ?? "initial"})`
  )
  const repos: RepoInfo[] = []
  const repoLimit = pLimit(6)
  const repoTasks = found.map((repo) =>
    repoLimit(async () => {
      const originUrl = await readOriginUrl(repo.path)
      const { host, ownerRepo } = parseOriginInfo(originUrl)
      const remoteTag = getRemoteTag(host)
      const manual = manualTags.get(normalizeRepoKey(repo.path))
      const dirty = await isDirty(repo.path)
      const baseTags = buildTags({
        remoteTag,
        autoTag: repo.autoTag,
        manualTags: manual,
        dirty
      })
      const baseRepo = {
        path: repo.path,
        ownerRepo: ownerRepo || path.basename(repo.path),
        originUrl: originUrl ?? undefined,
        tags: baseTags,
        lastScannedAt: Date.now()
      } satisfies RepoInfo
      const extraTags = await resolveTagExtensions({
        repoPath: baseRepo.path,
        scanRoot: repo.scanRoot,
        originUrl: baseRepo.originUrl,
        ownerRepo: baseRepo.ownerRepo,
        autoTag: repo.autoTag,
        manualTags: manual,
        dirty,
        baseTags
      })
      return {
        ...baseRepo,
        tags: uniqueTags([...baseTags, ...extraTags])
      } satisfies RepoInfo
    })
  )
  repos.push(...(await Promise.all(repoTasks)))
  const sorted = await applyLruIfNeeded(repos, normalized.lruFile)
  const buildFinishedAt = Date.now()
  const metadata: CacheMetadata = {
    cacheVersion: 1,
    scanStartedAt,
    scanFinishedAt,
    scanDurationMs,
    buildDurationMs: buildFinishedAt - buildStartedAt,
    repoCount: sorted.length,
    scanRoots: normalized.scanRoots,
    warningCount: warningCount > 0 ? warningCount : undefined,
    warningSamples: warningSamples.length > 0 ? warningSamples : undefined
  }
  const cache: CacheData = {
    savedAt: Date.now(),
    ttlMs: normalized.cacheTtlMs,
    metadata,
    repos: sorted
  }
  await ensureDir(path.dirname(normalized.cacheFile))
  await fs.writeFile(
    normalized.cacheFile,
    JSON.stringify(cache, null, 2),
    "utf8"
  )
  return cache
}

export async function loadCache(
  options: ScanOptions
): Promise<CacheData | null> {
  const normalized = normalizeOptions(options)
  try {
    const content = await fs.readFile(normalized.cacheFile, "utf8")
    let data: Partial<CacheData>
    try {
      data = JSON.parse(content) as Partial<CacheData>
    } catch {
      await handleCorruptedCache(normalized.cacheFile)
      return null
    }
    if (!data || !Array.isArray(data.repos)) {
      await handleCorruptedCache(normalized.cacheFile)
      return null
    }
    const ttlMs = data.ttlMs ?? normalized.cacheTtlMs
    const savedAt = data.savedAt ?? 0
    if (Date.now() - savedAt > ttlMs) {
      logger.debug("cache expired")
      return null
    }
    const repos = Array.isArray(data.repos) ? data.repos : []
    const existing = await filterExistingRepos(
      repos.map((repo) => ({ ...repo, path: path.resolve(repo.path) }))
    )
    const sorted = await applyLruIfNeeded(existing.repos, normalized.lruFile)
    const metadata = buildCacheMetadataFromCache(
      { ...data, repos: existing.repos } as CacheData,
      normalized.scanRoots,
      sorted.length
    )
    if (existing.prunedCount > 0) {
      metadata.prunedAt = Date.now()
      metadata.prunedRepoCount = existing.prunedCount
      await persistCache(normalized.cacheFile, {
        savedAt,
        ttlMs,
        metadata,
        repos: sorted
      })
    }
    logger.debug(`cache hit: ${sorted.length} repos`)
    return { savedAt, ttlMs, metadata, repos: sorted }
  } catch {
    return null
  }
}

export async function refreshCache(
  options: ScanOptions
): Promise<CacheData> {
  return buildCache(options, { reason: "refresh" })
}

async function applyLruIfNeeded(
  repos: RepoInfo[],
  lruFile?: string
): Promise<RepoInfo[]> {
  if (!lruFile) {
    return repos
  }
  const lruList = await readLru(lruFile)
  return sortByLru(repos, lruList)
}

function normalizeOptions(
  options: ScanOptions
): ScanOptions & {
  maxDepth: number
  pruneDirs: string[]
  cacheTtlMs: number
  followSymlinks: boolean
  cacheFile: string
  manualTagsFile: string
  lruFile: string
  lruLimit: number
} {
  const { cacheFile, manualTagsFile, lruFile } = getConfigPaths()
  return {
    scanRoots: options.scanRoots,
    maxDepth: options.maxDepth ?? 7,
    pruneDirs: options.pruneDirs ?? [],
    cacheTtlMs: options.cacheTtlMs ?? defaultTtlMs,
    followSymlinks: options.followSymlinks ?? false,
    cacheFile: options.cacheFile ?? cacheFile,
    manualTagsFile: options.manualTagsFile ?? manualTagsFile,
    lruFile: options.lruFile ?? lruFile,
    lruLimit: options.lruLimit ?? 300,
    onWarning: options.onWarning
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function filterExistingRepos(
  repos: RepoInfo[]
): Promise<{ repos: RepoInfo[]; prunedCount: number }> {
  if (repos.length === 0) {
    return { repos, prunedCount: 0 }
  }
  const limit = pLimit(8)
  const checks = await Promise.all(
    repos.map((repo) =>
      limit(async () => {
        try {
          await fs.access(repo.path)
          return true
        } catch {
          return false
        }
      })
    )
  )
  const filtered = repos.filter((_repo, index) => checks[index])
  return { repos: filtered, prunedCount: repos.length - filtered.length }
}

function buildCacheMetadataFromCache(
  data: CacheData,
  scanRoots: string[],
  repoCount: number
): CacheMetadata {
  if (data.metadata) {
    return { ...data.metadata, repoCount, scanRoots }
  }
  return {
    cacheVersion: 1,
    scanStartedAt: data.savedAt,
    scanFinishedAt: data.savedAt,
    scanDurationMs: 0,
    buildDurationMs: 0,
    repoCount,
    scanRoots
  }
}

async function persistCache(
  cacheFile: string,
  cache: CacheData
): Promise<void> {
  await ensureDir(path.dirname(cacheFile))
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf8")
}

async function handleCorruptedCache(cacheFile: string): Promise<void> {
  logger.debug("cache corrupted, rebuilding")
  await fs.unlink(cacheFile).catch(() => {})
}
