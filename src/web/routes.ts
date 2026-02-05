import path from "node:path"
import type { FastifyInstance } from "fastify"
import pLimit from "p-limit"
import { buildCache, loadCache, refreshCache } from "../core/cache"
import { buildRepoPreview } from "../core/preview"
import type { RepoInfo } from "../core/types"
import { normalizeRepoKey } from "../core/path-utils"
import { getRegisteredActions } from "../core/plugins"
import { registerBuiltInPlugins } from "../plugins/built-in"
import { parseTagList, upsertManualTags } from "../core/tags"
import { readLru, sortByLru } from "../core/lru"
import { execa } from "execa"
import type { UiState } from "./state"

type ServerOptions = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  followSymlinks?: boolean
  cacheFile: string
  manualTagsFile: string
  lruFile: string
}

type PaginatedRepos = {
  items: Array<RepoInfo & { isDirty?: boolean }>
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
  registerBuiltInPlugins()
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
    let repos = resolved.repos
    if (query.tag) {
      repos = repos.filter((repo) => repo.tags.includes(query.tag as string))
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
    const items = repos.slice(offset, offset + pageSize).map((repo) => ({
      ...repo,
      isDirty: repo.tags.includes("[dirty]")
    }))
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
    const preview = await previewLimit(() => buildRepoPreview(repo))
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
    const builtins = getBuiltinActions(repo, options)
    const plugins = getRegisteredActions()
    const action = [...builtins, ...plugins].find((item) => item.id === body.actionId)
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
    const body = request.body as { path?: string; tags?: string[] | string; refresh?: boolean }
    const allowedPath = resolveAllowedPath(options.scanRoots, body?.path)
    if (!allowedPath || !body.tags) {
      reply.code(400)
      return { error: "invalid path or tags" }
    }
    const tags = Array.isArray(body.tags) ? parseTagList(body.tags.join(" ")) : parseTagList(body.tags)
    await upsertManualTags(options.manualTagsFile, allowedPath, tags)
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

function getBuiltinActions(repo: RepoInfo, options: ServerOptions) {
  return [
    {
      id: "builtin.open-vscode",
      label: "open in VSCode",
      run: async () => {
        await execa("code", [repo.path], { reject: false })
      }
    },
    {
      id: "builtin.open-iterm",
      label: "open in iTerm",
      run: async () => {
        await execa("open", ["-a", "iTerm", repo.path], { reject: false })
      }
    },
    {
      id: "builtin.open-finder",
      label: "open in Finder",
      run: async () => {
        await execa("open", [repo.path], { reject: false })
      }
    },
    {
      id: "builtin.add-tag",
      label: "add tag",
      run: async () => {
        await execa("open", ["-e", options.manualTagsFile], { reject: false })
        await refreshCache(options)
      }
    },
    {
      id: "builtin.refresh-cache",
      label: "refresh cache",
      run: async () => {
        await refreshCache(options)
      }
    }
  ]
}
