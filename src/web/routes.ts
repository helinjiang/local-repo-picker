import path from "node:path"
import type { FastifyInstance } from "fastify"
import pLimit from "p-limit"
import { buildCache, loadCache, refreshCache } from "../core/cache"
import { buildRepoPreview } from "../core/preview"
import type { Action, RepoInfo } from "../core/types"
import { normalizeRepoKey } from "../core/path-utils"
import { getRegisteredActions } from "../core/plugins"
import { registerBuiltInPlugins } from "../plugins/built-in"
import { parseTagList, readManualTagEdits, setManualTags, updateManualTagEdits } from "../core/tags"
import { readLru, sortByLru } from "../core/lru"
import { getConfigPaths, readConfig, writeConfig } from "../config/config"
import type { AppConfig } from "../config/schema"
import type { UiState } from "./state"

type ServerOptions = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  followSymlinks?: boolean
  remoteHostTags?: Record<string, string>
  cacheFile: string
  manualTagsFile: string
  lruFile: string
}

type PaginatedRepos = {
  items: Array<{
    folderRelativePath: string
    folderFullPath: string
    key: string
    tags: string[]
    manualTags: string[]
    lastScannedAt: number
    isDirty?: boolean
  }>
  total: number
  page: number
  pageSize: number
}

class LruCache<K, V> {
  private readonly maxSize: number
  private readonly map = new Map<K, V>()

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as K | undefined
      if (oldest !== undefined) {
        this.map.delete(oldest)
      }
    }
  }
}

const previewCache = new LruCache<string, Awaited<ReturnType<typeof buildRepoPreview>>>(200)
const previewLimit = pLimit(4)

export async function registerRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: UiState
): Promise<void> {
  registerBuiltInPlugins(options)
  app.get("/api/status", async () => {
    const cached = await loadCache(options)
    return {
      url: state.url,
      port: state.port,
      pid: state.pid,
      startedAt: state.startedAt,
      cacheFresh: Boolean(cached),
      repoCount: cached ? cached.repos.length : 0
    }
  })

  app.get("/api/config", async () => {
    const config = await readConfig()
    const paths = getConfigPaths()
    return { config, paths }
  })

  app.post("/api/config", async (request, reply) => {
    const body = request.body as { config?: unknown }
    let raw = body?.config
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw)
      } catch {
        reply.code(400)
        return { error: "invalid config json" }
      }
    }
    if (!raw || typeof raw !== "object") {
      reply.code(400)
      return { error: "invalid config" }
    }
    try {
      await writeConfig(raw as AppConfig)
      const updated = await readConfig()
      options.scanRoots = updated.scanRoots
      options.maxDepth = updated.maxDepth
      options.pruneDirs = updated.pruneDirs
      options.cacheTtlMs = updated.cacheTtlMs
      options.followSymlinks = updated.followSymlinks
      const cache = await refreshCache({
        ...updated,
        cacheFile: options.cacheFile,
        manualTagsFile: options.manualTagsFile,
        lruFile: options.lruFile
      })
      return { ok: true, config: updated, repoCount: cache.repos.length }
    } catch (error) {
      reply.code(500)
      return { error: String(error instanceof Error ? error.message : error) }
    }
  })

  app.get("/api/actions", async () => {
    const actions = getRegisteredActions().filter((action) => isActionAllowed(action, "web"))
    return actions.map((action) => ({ id: action.id, label: action.label }))
  })

  app.get("/api/repos", async (request) => {
    const query = request.query as {
      q?: string
      tag?: string
      sort?: string
      page?: string
      pageSize?: string
    }
    const cached = await loadCache(options)
    const resolved = cached ?? (await buildCache(options))
    const manualEdits = await readManualTagEdits(options.manualTagsFile)
    let repos = resolved.repos
    if (query.tag) {
      if (query.tag === "[dirty]" || query.tag === "dirty") {
        repos = repos.filter((repo) => repo.isDirty)
      } else {
        repos = repos.filter((repo) => repo.tags.includes(query.tag ?? ""))
      }
    }
    if (query.q) {
      const keyword = query.q.toLowerCase()
      repos = repos.filter((repo) => {
        const hay = `${repo.ownerRepo} ${repo.path} ${repo.tags.join("")}`.toLowerCase()
        return hay.includes(keyword)
      })
    }
    if (query.sort === "name") {
      repos = repos.slice().sort((a, b) => a.ownerRepo.localeCompare(b.ownerRepo))
    } else if (query.sort === "lru") {
      const lruList = await readLru(options.lruFile)
      repos = sortByLru(repos, lruList)
    }
    const total = repos.length
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(Math.max(1, Number(query.pageSize) || 200), 500)
    const offset = (page - 1) * pageSize
    const items = repos.slice(offset, offset + pageSize).map((repo) => {
      const folderRelativePath = repo.ownerRepo || path.basename(repo.path)
      const folderFullPath = repo.path
      const key = buildRepoKeyFromTags(repo.tags, folderRelativePath)
      return {
        folderRelativePath,
        folderFullPath,
        key,
        tags: repo.tags,
        manualTags: manualEdits.get(normalizeRepoKey(repo.path))?.add ?? [],
        lastScannedAt: repo.lastScannedAt,
        isDirty: Boolean(repo.isDirty)
      }
    })
    const payload: PaginatedRepos = {
      items,
      total,
      page,
      pageSize
    }
    return payload
  })

  app.get("/api/preview", async (request, reply) => {
    const query = request.query as { path?: string }
    const allowedPath = resolveAllowedPath(options.scanRoots, query.path)
    if (!allowedPath) {
      reply.code(400)
      return { error: "path must be absolute and under scanRoots" }
    }
    const cached = previewCache.get(allowedPath)
    if (cached) {
      return cached
    }
    const repo = await resolveRepoInfo(options, allowedPath)
    const preview = await previewLimit(() =>
      buildRepoPreview(repo, { remoteHostTags: options.remoteHostTags })
    )
    previewCache.set(allowedPath, preview)
    return preview
  })

  app.post("/api/action", async (request, reply) => {
    const body = request.body as { actionId?: string; path?: string }
    const allowedPath = resolveAllowedPath(options.scanRoots, body?.path)
    if (!body?.actionId || !allowedPath) {
      reply.code(400)
      return { error: "invalid actionId or path" }
    }
    const repo = await resolveRepoInfo(options, allowedPath)
    const plugins = getRegisteredActions()
    const action = plugins
      .filter((item) => isActionAllowed(item, "web"))
      .find((item) => item.id === body.actionId)
    if (!action) {
      reply.code(404)
      return { error: "action not found" }
    }
    await action.run(repo)
    return { ok: true }
  })

  app.post("/api/cache/refresh", async () => {
    const cache = await refreshCache(options)
    return { ok: true, repoCount: cache.repos.length }
  })

  app.post("/api/tags", async (request, reply) => {
    const body = request.body as {
      path?: string
      tags?: string[] | string | { add?: string[]; remove?: string[] }
      refresh?: boolean
    }
    const allowedPath = resolveAllowedPath(options.scanRoots, body?.path)
    if (!allowedPath || !body.tags) {
      reply.code(400)
      return { error: "invalid path or tags" }
    }
    if (typeof body.tags === "object" && !Array.isArray(body.tags)) {
      const add = body.tags.add ? parseTagList(body.tags.add.join(" ")) : []
      const remove = body.tags.remove ? parseTagList(body.tags.remove.join(" ")) : []
      await updateManualTagEdits(options.manualTagsFile, allowedPath, { add, remove })
    } else {
      const tags = Array.isArray(body.tags) ? parseTagList(body.tags.join(" ")) : parseTagList(body.tags)
      await setManualTags(options.manualTagsFile, allowedPath, tags)
    }
    if (body.refresh ?? true) {
      await refreshCache(options)
    }
    return { ok: true }
  })
}

async function resolveRepoInfo(options: ServerOptions, repoPath: string): Promise<RepoInfo> {
  const cached = await loadCache(options)
  const resolvedPath = path.resolve(repoPath)
  const targetKey = normalizeRepoKey(resolvedPath)
  const found = cached?.repos.find((repo) => normalizeRepoKey(repo.path) === targetKey)
  if (found) {
    return found
  }
  return {
    path: resolvedPath,
    ownerRepo: path.basename(resolvedPath),
    tags: [],
    lastScannedAt: Date.now()
  }
}

function resolveAllowedPath(scanRoots: string[], repoPath?: string | null): string | null {
  if (!repoPath || !path.isAbsolute(repoPath)) {
    return null
  }
  const resolved = path.resolve(repoPath)
  const roots = scanRoots.map((root) => path.resolve(root))
  const allowed = roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))
  return allowed ? resolved : null
}

function isActionAllowed(action: Action, scope: "cli" | "web"): boolean {
  if (!action.scopes || action.scopes.length === 0) {
    return true
  }
  return action.scopes.includes(scope)
}

function buildRepoKeyFromTags(tags: string[], folderRelativePath: string): string {
  const tagValue = normalizeTagValue(resolveRemoteTagFromTags(tags))
  if (!tagValue || !folderRelativePath || folderRelativePath === "-") {
    return "-"
  }
  return `${tagValue}/${folderRelativePath}`
}

function resolveRemoteTagFromTags(tags: string[]): string {
  const remoteTag = tags.find(
    (tag) =>
      tag === "[github]" ||
      tag === "[gitee]" ||
      tag === "[noremote]" ||
      tag.startsWith("[internal:")
  )
  return remoteTag ?? tags[0] ?? ""
}

function normalizeTagValue(tag: string): string {
  const match = tag.match(/^\[(.*)\]$/)
  return match ? match[1] : tag
}
