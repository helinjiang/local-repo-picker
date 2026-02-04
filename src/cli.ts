#!/usr/bin/env node

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import readline from "node:readline/promises"
import { execa } from "execa"
import { buildCache, loadCache, refreshCache } from "./core/cache"
import { ensureConfigFile, getConfigPaths, readConfig, writeConfig } from "./config/config"
import { isDebugEnabled, logger } from "./core/logger"
import { buildFallbackPreview, buildRepoPreview, type RepoPreviewResult } from "./core/preview"
import type { RepoInfo } from "./core/types"
import { normalizeRepoKey } from "./core/path-utils"
import { updateLru } from "./core/lru"
import { getRegisteredActions } from "./core/plugins"
import { registerBuiltInPlugins } from "./plugins/built-in"

process.on("unhandledRejection", (reason) => {
  handleFatalError(reason)
})

process.on("uncaughtException", (error) => {
  handleFatalError(error)
})

await main()

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (args.includes("--help") || args.includes("-h")) {
    printHelp()
    return
  }

  if (args.includes("--version") || args.includes("-v")) {
    const version = await readPackageVersion()
    console.log(version || "0.0.0")
    return
  }

  if (args.includes("--config")) {
    const configFile = await ensureConfigFile()
    console.log(configFile)
    return
  }

  const { cacheFile, manualTagsFile, lruFile, configFile } = getConfigPaths()
  let config = await readConfig()
  const isInternal = typeof command === "string" && command.startsWith("__")

  if (!config.scanRoots || config.scanRoots.length === 0) {
    if (isInternal) {
      logger.error(`请在 ${configFile} 配置 scanRoots`)
      process.exitCode = 1
      return
    }
    const updated = await runSetupWizard(configFile)
    if (!updated) {
      logger.error(`请在 ${configFile} 配置 scanRoots`)
      process.exitCode = 1
      return
    }
    config = updated
  }

  const options = {
    ...config,
    cacheFile,
    manualTagsFile,
    lruFile
  }

  if (command === "refresh") {
    const cache = await refreshCache(options)
    if (cache.metadata.warningCount && cache.metadata.warningCount > 0) {
      console.error(`部分路径被跳过: ${cache.metadata.warningCount}`)
    }
    console.log(`refresh: ${cache.repos.length}`)
    return
  }

  if (command === "__list") {
    await runInternalList(options, args)
    return
  }

  if (command === "__preview") {
    await runInternalPreview(options, args)
    return
  }

  const listOnly = command === "list" || args.includes("--list")
  if (listOnly || !process.stdout.isTTY || !process.stdin.isTTY) {
    const cached = await loadCache(options)
    const resolved = cached ?? (await buildCache(options))
    if (resolved.metadata.warningCount && resolved.metadata.warningCount > 0) {
      console.error(`部分路径被跳过: ${resolved.metadata.warningCount}`)
    }
    for (const repo of resolved.repos) {
      console.log(repo.path)
    }
    return
  }
  const ok = await ensureFzfAvailable()
  if (!ok) {
    process.exitCode = 1
    return
  }
  const selected = await runFzfPicker(options, config.fzfTagFilters ?? {})
  if (selected) {
    await updateLru(options.lruFile, selected)
    const picked = await resolveRepoInfo(options, selected)
    const action = await runFzfActionPicker(picked, options)
    if (!action) {
      console.log(selected)
      return
    }
    await action.run(picked)
  }
}

async function runInternalList(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  args: string[]
): Promise<void> {
  const filterTag = readArgValue(args, "--filter-tag")
  const rows = await getListRows(options, filterTag)
  for (const row of rows) {
    console.log(`${row.display}\t${row.path}\t${row.rawTags}`)
  }
}

async function runInternalPreview(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  args: string[]
): Promise<void> {
  const rawPath = readArgValue(args, "--path")
  if (!rawPath) {
    logger.error("missing --path")
    process.exitCode = 1
    return
  }
  if (!path.isAbsolute(rawPath)) {
    logger.error("path must be absolute")
    process.exitCode = 1
    return
  }
  const repoPath = path.resolve(rawPath)
  const repo = await resolveRepoInfo(options, repoPath)
  const result = await buildPreviewWithTimeout(repo, 2000)
  const lines = formatPreviewLines(result)
  console.log(lines.join("\n"))
}

async function resolveRepoInfo(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  repoPath: string
): Promise<RepoInfo> {
  const cached = await loadCache(options)
  const targetKey = normalizeRepoKey(repoPath)
  const found = cached?.repos.find((repo) => normalizeRepoKey(repo.path) === targetKey)
  if (found) {
    return found
  }
  return {
    path: repoPath,
    ownerRepo: path.basename(repoPath),
    tags: [],
    lastScannedAt: Date.now()
  }
}

async function buildPreviewWithTimeout(repo: RepoInfo, timeoutMs: number): Promise<RepoPreviewResult> {
  let timer: NodeJS.Timeout | null = null
  const timeout = new Promise<RepoPreviewResult>((resolve) => {
    timer = setTimeout(() => {
      resolve(buildFallbackPreview(repo.path, "preview timed out"))
    }, timeoutMs)
  })
  const result = await Promise.race([buildRepoPreview(repo), timeout])
  if (timer) {
    clearTimeout(timer)
  }
  return result
}

function formatPreviewLines(result: RepoPreviewResult): string[] {
  const lines: string[] = []
  if (result.error) {
    lines.push(result.error)
    lines.push("")
  }
  lines.push(`PATH: ${result.data.path}`)
  lines.push(`ORIGIN: ${result.data.origin}`)
  lines.push(`BRANCH: ${result.data.branch}`)
  lines.push(`STATUS: ${result.data.status}`)
  if (result.data.sync !== "-") {
    lines.push(`SYNC: ${result.data.sync}`)
  }
  lines.push("")
  lines.push("RECENT COMMITS:")
  if (result.data.recentCommits.length > 0) {
    lines.push(...result.data.recentCommits)
  } else {
    lines.push("无提交信息")
  }
  lines.push("")
  lines.push("README:")
  if (result.data.readme.length > 0) {
    lines.push(...result.data.readme.map((line) => (line === "" ? " " : line)))
  } else if (result.data.readmeStatus === "unavailable") {
    lines.push("README unavailable")
  } else {
    lines.push("无 README")
  }
  if (result.data.extensions.length > 0) {
    lines.push("")
    for (const section of result.data.extensions) {
      lines.push(`${section.title}:`)
      if (section.lines.length > 0) {
        lines.push(...section.lines)
      } else {
        lines.push("-")
      }
    }
  }
  return lines
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

function readArgValue(args: string[], key: string): string {
  const index = args.indexOf(key)
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1]
  }
  return ""
}

async function getListRows(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  filterTag?: string
): Promise<Array<{ display: string; path: string; rawTags: string }>> {
  const cached = await loadCache(options)
  const resolved = cached ?? (await buildCache(options))
  const rows = filterTag
    ? resolved.repos.filter((repo) => repo.tags.some((tag) => tag.includes(filterTag)))
    : resolved.repos
  return rows.map((repo) => ({
    display: buildListDisplay(repo),
    path: repo.path,
    rawTags: repo.tags.join("")
  }))
}

async function ensureFzfAvailable(): Promise<boolean> {
  try {
    const result = await execa("fzf", ["--version"], {
      stdout: "ignore",
      stderr: "ignore",
      reject: false
    })
    if (result.exitCode === 0) {
      return true
    }
  } catch {
    logger.error("未检测到 fzf，请先安装：brew install fzf")
    return false
  }
  logger.error("未检测到 fzf，请先安装：brew install fzf")
  return false
}

async function runFzfPicker(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  filters: Record<string, string>
): Promise<string | null> {
  const listResult = await execa("repo", ["__list", "--all"], {
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (listResult.exitCode !== 0) {
    logger.error("repo __list 执行失败")
    return null
  }
  const input = listResult.stdout.trimEnd()
  const binds = buildFzfBinds(filters)
  const args = [
    "--ansi",
    "--delimiter=\t",
    "--with-nth=1",
    "--preview",
    "repo __preview --path {2}",
    "--preview-window=right:60%:wrap",
    "--bind",
    binds
  ]
  const result = await execa("fzf", args, {
    input,
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (result.exitCode !== 0) {
    return null
  }
  const line = result.stdout.trim()
  if (!line) {
    return null
  }
  const parts = line.split("\t")
  return parts[1]?.trim() || null
}

async function runFzfActionPicker(
  repo: RepoInfo,
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  }
) {
  registerBuiltInPlugins()
  const actions = getRegisteredActions()
  const builtins = getBuiltinActions(repo, options)
  const merged = [...builtins, ...actions]
  if (merged.length === 0) {
    return null
  }
  const input = merged.map((item) => `${item.label}\t${item.id}`).join("\n")
  const result = await execa("fzf", ["--delimiter=\t", "--with-nth=1", "--prompt", "Action> "], {
    input,
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (result.exitCode !== 0) {
    return null
  }
  const line = result.stdout.trim()
  if (!line) {
    return null
  }
  const id = line.split("\t")[1]
  return merged.find((item) => item.id === id) ?? null
}

function getBuiltinActions(
  repo: RepoInfo,
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  }
) {
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

function buildFzfBinds(filters: Record<string, string>): string {
  const entries = Object.entries(filters)
  if (entries.length === 0) {
    return "ctrl-a:reload(repo __list --all)"
  }
  const binds = entries.map(([key, tag]) => {
    if (tag === "all") {
      return `${key}:reload(repo __list --all)`
    }
    return `${key}:reload(repo __list --filter-tag ${escapeShellArg(tag)})`
  })
  if (!filters["ctrl-a"]) {
    binds.push("ctrl-a:reload(repo __list --all)")
  }
  return binds.join(",")
}

function escapeShellArg(input: string): string {
  const safe = input.replace(/'/g, "'\"'\"'")
  return `'${safe}'`
}

async function runSetupWizard(configFile: string) {
  if (!process.stdin.isTTY) {
    return null
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  console.log("首次运行向导")
  console.log(`配置文件: ${configFile}`)
  const defaultRoot = path.join(os.homedir(), "workspace")
  const scanRoots = await promptScanRoots(rl, defaultRoot)
  if (scanRoots.length === 0) {
    rl.close()
    return null
  }
  const maxDepth = await promptNumber(rl, "maxDepth", 7)
  const pruneDirs = await promptList(rl, "pruneDirs（逗号分隔，可留空）")
  const followSymlinks = await promptYesNo(rl, "followSymlinks（y/N）", false)
  rl.close()
  await writeConfig({ scanRoots, maxDepth, pruneDirs, followSymlinks })
  return await readConfig()
}

async function promptScanRoots(
  rl: readline.Interface,
  defaultRoot: string
): Promise<string[]> {
  while (true) {
    const raw = (await rl.question(`请输入 scanRoots（逗号分隔，默认: ${defaultRoot}）: `)).trim()
    const candidates = (raw ? raw.split(",") : [defaultRoot])
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => expandPath(item))
      .map((item) => path.resolve(item))
    const { valid, invalid } = await splitValidPaths(candidates)
    if (invalid.length > 0) {
      console.log(`以下路径无效或不可访问: ${invalid.join(", ")}`)
    }
    if (valid.length > 0) {
      return valid
    }
    console.log("至少需要一个有效的 scanRoot")
  }
}

async function promptNumber(
  rl: readline.Interface,
  label: string,
  defaultValue: number
): Promise<number> {
  while (true) {
    const raw = (await rl.question(`${label}（默认: ${defaultValue}）: `)).trim()
    if (!raw) {
      return defaultValue
    }
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value)
    }
    console.log("请输入有效数字")
  }
}

async function promptList(
  rl: readline.Interface,
  label: string
): Promise<string[]> {
  const raw = (await rl.question(`${label}: `)).trim()
  if (!raw) {
    return []
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

async function promptYesNo(
  rl: readline.Interface,
  label: string,
  defaultValue: boolean
): Promise<boolean> {
  const raw = (await rl.question(`${label}: `)).trim().toLowerCase()
  if (!raw) {
    return defaultValue
  }
  return raw === "y" || raw === "yes"
}

async function splitValidPaths(paths: string[]): Promise<{
  valid: string[]
  invalid: string[]
}> {
  const valid: string[] = []
  const invalid: string[] = []
  for (const item of paths) {
    try {
      const stat = await fs.stat(item)
      if (stat.isDirectory()) {
        valid.push(item)
      } else {
        invalid.push(item)
      }
    } catch {
      invalid.push(item)
    }
  }
  return { valid, invalid }
}

function expandPath(input: string): string {
  if (input.startsWith("~")) {
    return path.join(os.homedir(), input.slice(1))
  }
  return input
}

function printHelp(): void {
  const lines = [
    "Usage: repo [command] [options]",
    "",
    "Commands:",
    "  refresh            强制重建 cache",
    "  list               输出 repo 路径列表",
    "",
    "Options:",
    "  --config           创建默认配置并输出路径",
    "  --list             输出 repo 路径列表",
    "  -h, --help         显示帮助",
    "  -v, --version      显示版本号"
  ]
  console.log(lines.join("\n"))
}

async function readPackageVersion(): Promise<string> {
  const packageFile = path.resolve(process.cwd(), "package.json")
  try {
    const content = await fs.readFile(packageFile, "utf8")
    const data = JSON.parse(content) as { version?: string }
    return typeof data.version === "string" ? data.version : ""
  } catch {
    return ""
  }
}

function handleFatalError(error: unknown): void {
  const message = formatError(error)
  logger.error(`发生错误: ${message}`)
  if (isDebugEnabled() && error instanceof Error && error.stack) {
    logger.error(error.stack)
  }
  process.exitCode = 1
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "未知错误"
  }
  if (typeof error === "string") {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return "未知错误"
  }
}
