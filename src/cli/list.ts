import path from "node:path"
import { buildCache, loadCache } from "../core/cache"
import type { RepoInfo } from "../core/types"
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
    const action = await runFzfActionPicker(repo, options)
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
      path: repo.path,
      ownerRepo: repo.ownerRepo || path.basename(repo.path),
      tags: repo.tags,
      originUrl: repo.originUrl ?? null,
      lastScannedAt: repo.lastScannedAt
    }))
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  if (flags.format === "tsv") {
    for (const repo of repos) {
      const name = repo.ownerRepo || path.basename(repo.path)
      const tags = repo.tags.join("")
      console.log(`${name}\t${repo.path}\t${tags}`)
    }
    return
  }
  for (const repo of repos) {
    const name = repo.ownerRepo || path.basename(repo.path)
    const tags = repo.tags.join("")
    const label = tags ? `${name} ${tags}` : name
    console.log(`${label}  ${repo.path}`)
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
  repos: RepoInfo[],
  flags: { query: string; tag: string; dirtyOnly: boolean }
): RepoInfo[] {
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
          !repo.tags.some((tag) => tag.includes(flags.tag))
        ) {
          return false
        }
      }
    }
    if (query) {
      const haystack =
        `${repo.ownerRepo} ${repo.path} ${repoCodePlatform(repo)} ${repo.tags.join(" ")}`.toLowerCase()
      if (!haystack.includes(query)) {
        return false
      }
    }
    return true
  })
}

async function sortListRepos(
  repos: RepoInfo[],
  sort: "lru" | "name",
  lruFile: string
): Promise<RepoInfo[]> {
  if (sort === "name") {
    return repos
      .slice()
      .sort((a, b) => {
        const nameA = a.ownerRepo || path.basename(a.path)
        const nameB = b.ownerRepo || path.basename(b.path)
        const compare = nameA.localeCompare(nameB)
        if (compare !== 0) {
          return compare
        }
        return a.path.localeCompare(b.path)
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
            repo.tags.some((tag) => tag.includes(filterTag))
        )
    : resolved.repos
  return rows.map((repo) => ({
    display: buildListDisplay(repo),
    path: repo.path,
    rawTags: repo.tags.join("")
  }))
}

function buildListDisplay(repo: RepoInfo): string {
  const name = repo.ownerRepo || path.basename(repo.path)
  const rawTags = repo.tags.join("")
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

function repoCodePlatform(repo: RepoInfo): string {
  return repo.codePlatform ?? resolveCodePlatformFromTags(repo.tags)
}

function isCodePlatformMatch(codePlatform: string, filter: string): boolean {
  if (!filter) return false
  const normalizedPlatform = normalizeCodePlatform(codePlatform)
  const normalizedFilter = normalizeCodePlatform(filter)
  return normalizedPlatform !== "" && normalizedPlatform === normalizedFilter
}

function resolveCodePlatformFromTags(tags: string[]): string {
  const remoteTag = tags.find(
    (tag) =>
      tag === "[github]" ||
      tag === "[gitee]" ||
      tag === "[noremote]" ||
      tag.startsWith("[internal:")
  )
  return remoteTag ?? ""
}

function normalizeCodePlatform(platform: string): string {
  const trimmed = platform.trim()
  if (!trimmed) {
    return ""
  }
  const match = trimmed.match(/^\[(.*)\]$/)
  return match ? match[1] : trimmed
}
