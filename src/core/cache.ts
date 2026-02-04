import path from "node:path"
import { promises as fs } from "node:fs"
import type { CacheData, RepoInfo, ScanOptions } from "./types.js"
import { scanRepos } from "./scan.js"
import { readManualTags, buildTags, getRemoteTag } from "./tags.js"
import { isDirty, parseOriginInfo, readOriginUrl } from "./git.js"
import { readLru, sortByLru } from "./lru.js"
import { getConfigPaths } from "../config/config.js"

const defaultTtlMs = 12 * 60 * 60 * 1000

export async function buildCache(
  options: ScanOptions
): Promise<CacheData> {
  const normalized = normalizeOptions(options)
  const manualTags = await readManualTags(normalized.manualTagsFile)
  const found = await scanRepos(normalized)
  const repos: RepoInfo[] = []
  for (const repo of found) {
    const originUrl = await readOriginUrl(repo.path)
    const { host, ownerRepo } = parseOriginInfo(originUrl)
    const remoteTag = getRemoteTag(host)
    const manual = manualTags.get(repo.path)
    const dirty = await isDirty(repo.path)
    const tags = buildTags({
      remoteTag,
      autoTag: repo.autoTag,
      manualTags: manual,
      dirty
    })
    repos.push({
      path: repo.path,
      ownerRepo: ownerRepo || path.basename(repo.path),
      originUrl: originUrl ?? undefined,
      tags,
      lastScannedAt: Date.now()
    })
  }
  const sorted = await applyLruIfNeeded(repos, normalized.lruFile)
  const cache: CacheData = {
    savedAt: Date.now(),
    ttlMs: normalized.cacheTtlMs,
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
    const data = JSON.parse(content) as CacheData
    const ttlMs = data.ttlMs ?? normalized.cacheTtlMs
    if (Date.now() - data.savedAt > ttlMs) {
      return null
    }
    const sorted = await applyLruIfNeeded(data.repos, normalized.lruFile)
    return { savedAt: data.savedAt, ttlMs, repos: sorted }
  } catch {
    return null
  }
}

export async function refreshCache(
  options: ScanOptions
): Promise<CacheData> {
  return buildCache(options)
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

function normalizeOptions(options: ScanOptions): Required<ScanOptions> {
  const { cacheFile, manualTagsFile, lruFile } = getConfigPaths()
  return {
    scanRoots: options.scanRoots,
    maxDepth: options.maxDepth ?? 7,
    pruneDirs: options.pruneDirs ?? [],
    cacheTtlMs: options.cacheTtlMs ?? defaultTtlMs,
    cacheFile: options.cacheFile ?? cacheFile,
    manualTagsFile: options.manualTagsFile ?? manualTagsFile,
    lruFile: options.lruFile ?? lruFile,
    lruLimit: options.lruLimit ?? 300
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}
