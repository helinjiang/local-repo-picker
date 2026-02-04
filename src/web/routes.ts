import path from "node:path"
import type { FastifyInstance } from "fastify"
import { buildCache, loadCache, refreshCache } from "../core/cache"
import { buildRepoPreview } from "../core/preview"
import type { RepoInfo } from "../core/types"
import { normalizeRepoKey } from "../core/path-utils"
import { getRegisteredActions } from "../core/plugins"
import { registerBuiltInPlugins } from "../plugins/built-in"
import { parseTagList, upsertManualTags } from "../core/tags"
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
    const query = request.query as { q?: string; tag?: string; sort?: string }
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
    }
    return repos.map((repo) => ({
      ...repo,
      isDirty: repo.tags.includes("[dirty]")
    }))
  })

  app.get("/api/preview", async (request, reply) => {
    const query = request.query as { path?: string }
    if (!query.path || !path.isAbsolute(query.path)) {
      reply.code(400)
      return { error: "path must be absolute" }
    }
    const repo = await resolveRepoInfo(options, query.path)
    return await buildRepoPreview(repo)
  })

  app.post("/api/action", async (request, reply) => {
    const body = request.body as { actionId?: string; path?: string }
    if (!body?.actionId || !body?.path || !path.isAbsolute(body.path)) {
      reply.code(400)
      return { error: "invalid actionId or path" }
    }
    const repo = await resolveRepoInfo(options, body.path)
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
    if (!body?.path || !path.isAbsolute(body.path) || !body.tags) {
      reply.code(400)
      return { error: "invalid path or tags" }
    }
    const tags = Array.isArray(body.tags) ? parseTagList(body.tags.join(" ")) : parseTagList(body.tags)
    await upsertManualTags(options.manualTagsFile, body.path, tags)
    if (body.refresh ?? true) {
      await refreshCache(options)
    }
    return { ok: true }
  })
}

async function resolveRepoInfo(options: ServerOptions, repoPath: string): Promise<RepoInfo> {
  const cached = await loadCache(options)
  const targetKey = normalizeRepoKey(repoPath)
  const found = cached?.repos.find((repo) => normalizeRepoKey(repo.path) === targetKey)
  if (found) {
    return found
  }
  return {
    path: path.resolve(repoPath),
    ownerRepo: path.basename(repoPath),
    tags: [],
    lastScannedAt: Date.now()
  }
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
