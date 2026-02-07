import path from "node:path"
import { buildCache, loadCache } from "../core/cache"
import type { RepositoryRecord } from "../core/types"
import { readLru, sortByLru } from "../core/lru"
import { logger } from "../core/logger"
import type { CliOptions } from "./types"
import { formatError } from "./errors"
import { runFzfActionPicker, runFzfPicker, checkFzfAvailable } from "./fzf"
import { resolveRepoInfo } from "./repo"
import { readArgValue } from "./utils"

export async function runListCommand(options: CliOptions, args: string[]): Promise<void> {
  const isTty = process.stdout.isTTY
  const hasFzf = isTty ? await checkFzfAvailable() : false
  if (isTty && !hasFzf) {
    console.error("未检测到 fzf（可选，仅终端交互使用），安装：brew install fzf")
  }
  let flags: {
    format: "text" | "json" | "tsv"
    query: string
    tag: string
    dirtyOnly: boolean
    sort: "lru" | "name"
  }
  try {
    flags = parseListFlags(args)
  } catch (error) {
    logger.error(formatError(error))
    process.exitCode = 1
    return
  }
  const cached = await loadCache(options)
  if (!cached) {
    logger.error("cache 不存在或已过期，请先运行 `repo refresh`")
    process.exitCode = 1
    return
  }
  if (isTty && hasFzf && flags.format === "text" && !flags.query && !flags.tag && !flags.dirtyOnly) {
    const selected = await runFzfPicker(options, options.fzfTagFilters ?? {})
    if (!selected) {
      return
    }
    const repo = await resolveRepoInfo(options, selected)
    const action = await runFzfActionPicker(options)
    if (!action) {
      return
    }
    await action.run(repo)
    return
  }
  let repos = cached.repos.slice()
  repos = filterListRepos(repos, flags)
  repos = await sortListRepos(repos, flags.sort, options.lruFile)
  if (flags.format === "json") {
    const payload = repos.map((repo) => ({
      path: repo.fullPath,
      name: repoDisplayName(repo),
      recordKey: repo.recordKey,
      tags: recordTags(repo),
      originUrl: repo.git?.originUrl ?? null,
      lastScannedAt: repo.lastScannedAt
    }))
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  if (flags.format === "tsv") {
    for (const repo of repos) {
      const name = repoDisplayName(repo)
      const tags = recordTags(repo).join("")
      console.log(`${name}\t${repo.fullPath}\t${tags}`)
    }
    return
  }
  for (const repo of repos) {
    const name = repoDisplayName(repo)
    const tags = recordTags(repo).join("")
    const label = tags ? `${name} ${tags}` : name
    console.log(`${label}  ${repo.fullPath}`)
  }
}

export async function runInternalList(options: CliOptions, args: string[]): Promise<void> {
  const filterTag = readArgValue(args, "--filter-tag")
  const rows = await getListRows(options, filterTag)
  for (const row of rows) {
    console.log(`${row.display}\t${row.path}\t${row.rawTags}`)
  }
}

function parseListFlags(args: string[]): {
  format: "text" | "json" | "tsv"
  query: string
  tag: string
  dirtyOnly: boolean
  sort: "lru" | "name"
} {
  const useJson = args.includes("--json")
  const useTsv = args.includes("--tsv")
  if (useJson && useTsv) {
    throw new Error("--json 与 --tsv 不能同时使用")
  }
  const format = useJson ? "json" : useTsv ? "tsv" : "text"
  const query = readArgValue(args, "--q").trim()
  const rawTag = readArgValue(args, "--tag").trim()
  const tag = normalizeTagFilter(rawTag)
  const dirtyOnly = args.includes("--dirty")
  const rawSort = readArgValue(args, "--sort").trim()
  const sort = rawSort ? rawSort : "lru"
  if (sort !== "lru" && sort !== "name") {
    throw new Error(`无效排序: ${sort}，仅支持 lru|name`)
  }
  return { format, query, tag, dirtyOnly, sort }
}

function normalizeTagFilter(raw: string): string {
  if (!raw) {
    return ""
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw
  }
  return `[${raw}]`
}

function filterListRepos(
  repos: RepositoryRecord[],
  flags: { query: string; tag: string; dirtyOnly: boolean }
): RepositoryRecord[] {
  const query = flags.query.toLowerCase()
  return repos.filter((repo) => {
    if (flags.dirtyOnly && !repo.isDirty) {
      return false
    }
    if (flags.tag) {
      if (isDirtyFilter(flags.tag)) {
        if (!repo.isDirty) return false
      } else {
        const codePlatform = repoCodePlatform(repo)
        if (
          !isCodePlatformMatch(codePlatform, flags.tag) &&
          !recordTags(repo).some((tag) => tag.includes(flags.tag))
        ) {
          return false
        }
      }
    }
    if (query) {
      const haystack =
        `${repoDisplayName(repo)} ${repo.fullPath} ${repoCodePlatform(repo)} ${recordTags(repo).join(" ")}`.toLowerCase()
      if (!haystack.includes(query)) {
        return false
      }
    }
    return true
  })
}

async function sortListRepos(
  repos: RepositoryRecord[],
  sort: "lru" | "name",
  lruFile: string
): Promise<RepositoryRecord[]> {
  if (sort === "name") {
    return repos
      .slice()
      .sort((a, b) => {
        const nameA = repoDisplayName(a)
        const nameB = repoDisplayName(b)
        const compare = nameA.localeCompare(nameB)
        if (compare !== 0) {
          return compare
        }
        return a.fullPath.localeCompare(b.fullPath)
      })
  }
  const lruList = await readLru(lruFile)
  return sortByLru(repos, lruList)
}

async function getListRows(
  options: CliOptions,
  filterTag?: string
): Promise<Array<{ display: string; path: string; rawTags: string }>> {
  const cached = await loadCache(options)
  const resolved = cached ?? (await buildCache(options))
  const rows = filterTag
    ? isDirtyFilter(filterTag)
      ? resolved.repos.filter((repo) => repo.isDirty)
      : resolved.repos.filter(
          (repo) =>
            isCodePlatformMatch(repoCodePlatform(repo), filterTag) ||
            recordTags(repo).some((tag) => tag.includes(filterTag))
        )
    : resolved.repos
  return rows.map((repo) => ({
    display: buildListDisplay(repo),
    path: repo.fullPath,
    rawTags: recordTags(repo).join("")
  }))
}

function buildListDisplay(repo: RepositoryRecord): string {
  const name = repoDisplayName(repo)
  const rawTags = recordTags(repo).join("")
  if (!rawTags) {
    return name
  }
  return `${name} ${applyAnsiTag(rawTags)}`
}

function applyAnsiTag(input: string): string {
  return `\u001b[36m${input}\u001b[0m`
}

function isDirtyFilter(tag: string): boolean {
  return tag === "dirty" || tag === "[dirty]"
}

function repoCodePlatform(repo: RepositoryRecord): string {
  return repo.git?.provider ?? "unknown"
}

function isCodePlatformMatch(codePlatform: string, filter: string): boolean {
  if (!filter) return false
  const normalizedPlatform = normalizeCodePlatform(codePlatform)
  const normalizedFilter = normalizeCodePlatform(filter)
  return normalizedPlatform !== "" && normalizedPlatform === normalizedFilter
}

function recordTags(repo: RepositoryRecord): string[] {
  return [...repo.autoTags, ...repo.manualTags]
}

function repoDisplayName(repo: RepositoryRecord): string {
  if (repo.git?.fullName) {
    return repo.git.fullName
  }
  if (repo.relativePath) {
    return repo.relativePath
  }
  return path.basename(repo.fullPath)
}

function normalizeCodePlatform(platform: string): string {
  const trimmed = platform.trim()
  if (!trimmed) {
    return ""
  }
  const match = trimmed.match(/^\[(.*)\]$/)
  return match ? match[1] : trimmed
}
