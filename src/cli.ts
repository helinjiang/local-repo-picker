#!/usr/bin/env node

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import readline from "node:readline/promises"
import net from "node:net"
import { spawn } from "node:child_process"
import { execa } from "execa"
import { buildCache, loadCache, refreshCache } from "./core/cache"
import { ensureConfigFile, getConfigPaths, readConfig, writeConfig } from "./config/config"
import type { ConfigPaths } from "./config/config"
import { isDebugEnabled, logger } from "./core/logger"
import { buildFallbackPreview, buildRepoPreview, type RepoPreviewResult } from "./core/preview"
import type { Action, RepoInfo } from "./core/types"
import { normalizeRepoKey } from "./core/path-utils"
import { readLru, sortByLru } from "./core/lru"
import { getRegisteredActions } from "./core/plugins"
import { registerBuiltInPlugins } from "./plugins/built-in"
import { startWebServer } from "./web/server"
import type { UiState } from "./web/state"
import { clearUiState, isProcessAlive, readUiState } from "./web/state"

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

  if (args.length === 0) {
    printHelp()
    return
  }

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

  if (command === "status") {
    await runStatus(args)
    return
  }

  if (command === "ui") {
    const subcommand = args[1]
    if (subcommand === "stop") {
      await stopUiServer({ allowMissing: false })
      return
    }
    if (subcommand === "restart") {
      await stopUiServer({ allowMissing: true })
      const restartArgs = ["ui", ...args.slice(2)]
      let uiFlags: { port?: number; noOpen: boolean; dev: boolean }
      try {
        uiFlags = parseUiFlags(restartArgs)
      } catch (error) {
        logger.error(formatError(error))
        process.exitCode = 1
        return
      }
      await startUiInBackground(args.slice(2))
      const startedState = await waitForUiState(8000)
      if (!startedState) {
        logger.error("启动 Web UI 失败")
        process.exitCode = 1
        return
      }
      console.log(startedState.url)
      if (!uiFlags.noOpen) {
        await openBrowserOnMac(startedState.url)
      }
      return
    }
    let uiFlags: { port?: number; noOpen: boolean; dev: boolean }
    try {
      uiFlags = parseUiFlags(args)
    } catch (error) {
      logger.error(formatError(error))
      process.exitCode = 1
      return
    }
    const state = await readUiState()
    if (state && isProcessAlive(state.pid)) {
      console.log(state.url)
      return
    }
    await startUiInBackground(args.slice(1))
    const startedState = await waitForUiState(8000)
    if (!startedState) {
      logger.error("启动 Web UI 失败")
      process.exitCode = 1
      return
    }
    console.log(startedState.url)
    if (!uiFlags.noOpen) {
      await openBrowserOnMac(startedState.url)
    }
    return
  }

  const { cacheFile, manualTagsFile, lruFile, configFile } = getConfigPaths()
  let config = await readConfig()
  const isInternal = typeof command === "string" && command.startsWith("__")
  const listOnly = command === "list" || args.includes("--list")

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

  if (command === "__ui-serve") {
    let uiFlags: { port?: number; noOpen: boolean; dev: boolean }
    try {
      uiFlags = parseUiFlags(args)
    } catch (error) {
      logger.error(formatError(error))
      process.exitCode = 1
      return
    }
    await runUiServer(options, uiFlags)
    return
  }

  if (listOnly) {
    await runListCommand(options, args)
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

  logger.error("未知命令，请使用 --help 查看用法")
  process.exitCode = 1
}

async function runStatus(args: string[]): Promise<void> {
  const useJson = args.includes("--json")
  const paths = getConfigPaths()
  const fzfAvailable = await checkFzfAvailable()
  const state = await readUiState()
  if (!state) {
    if (useJson) {
      console.log(
        JSON.stringify({
          running: false,
          fzfAvailable,
          paths
        })
      )
    } else {
      console.log("UI not running, run `repo ui`")
      console.log(`fzf: ${fzfAvailable ? "available" : "missing"}`)
      printConfigPaths(paths)
    }
    process.exitCode = 1
    return
  }
  if (!isProcessAlive(state.pid)) {
    await clearUiState()
    if (useJson) {
      console.log(
        JSON.stringify({
          running: false,
          crashed: true,
          fzfAvailable,
          paths,
          lastUrl: state.url,
          lastPid: state.pid,
          startedAt: state.startedAt
        })
      )
    } else {
      console.log("UI not running, run `repo ui` (last run crashed)")
      console.log(`fzf: ${fzfAvailable ? "available" : "missing"}`)
      printConfigPaths(paths)
    }
    process.exitCode = 1
    return
  }
  if (useJson) {
    console.log(
      JSON.stringify({
        running: true,
        fzfAvailable,
        paths,
        url: state.url,
        pid: state.pid,
        port: state.port,
        startedAt: state.startedAt
      })
    )
    return
  }
  console.log(state.url)
  console.log(`fzf: ${fzfAvailable ? "available" : "missing"}`)
  printConfigPaths(paths)
}

function printConfigPaths(paths: ConfigPaths): void {
  console.log("paths:")
  console.log(`  configFile: ${paths.configFile}`)
  console.log(`  cacheFile: ${paths.cacheFile}`)
  console.log(`  manualTagsFile: ${paths.manualTagsFile}`)
  console.log(`  lruFile: ${paths.lruFile}`)
  console.log(`  configDir: ${paths.configDir}`)
  console.log(`  dataDir: ${paths.dataDir}`)
  console.log(`  cacheDir: ${paths.cacheDir}`)
}

async function stopUiServer(options: { allowMissing: boolean }): Promise<void> {
  const state = await readUiState()
  if (!state) {
    if (!options.allowMissing) {
      console.log("UI not running, run `repo ui`")
      process.exitCode = 1
    }
    return
  }
  if (!isProcessAlive(state.pid)) {
    await clearUiState()
    if (!options.allowMissing) {
      console.log("UI not running, run `repo ui` (last run crashed)")
      process.exitCode = 1
    }
    return
  }
  try {
    process.kill(state.pid, "SIGTERM")
  } catch (error) {
    logger.error(formatError(error))
    process.exitCode = 1
    return
  }
  const stopped = await waitForProcessExit(state.pid, 4000)
  if (!stopped) {
    try {
      process.kill(state.pid, "SIGKILL")
    } catch (error) {
      logger.error(formatError(error))
      process.exitCode = 1
      return
    }
    const forced = await waitForProcessExit(state.pid, 2000)
    if (!forced) {
      logger.error("无法停止 Web UI 进程")
      process.exitCode = 1
      return
    }
  }
  await clearUiState()
  console.log("Web UI stopped")
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true
    }
    await delay(200)
  }
  return false
}

async function waitForUiState(timeoutMs: number): Promise<UiState | null> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const state = await readUiState()
    if (state && isProcessAlive(state.pid)) {
      return state
    }
    await delay(200)
  }
  return null
}

async function startUiInBackground(args: string[]): Promise<void> {
  const cliPath = process.argv[1]
  const childArgs = [cliPath, "__ui-serve", ...args]
  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: "ignore"
  })
  child.unref()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runListCommand(
  options: {
    scanRoots: string[]
    maxDepth?: number
    pruneDirs?: string[]
    cacheTtlMs?: number
    followSymlinks?: boolean
    fzfTagFilters?: Record<string, string>
    cacheFile: string
    manualTagsFile: string
    lruFile: string
  },
  args: string[]
): Promise<void> {
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
    if (flags.dirtyOnly && !repo.tags.includes("[dirty]")) {
      return false
    }
    if (flags.tag && !repo.tags.some((tag) => tag.includes(flags.tag))) {
      return false
    }
    if (query) {
      const haystack = `${repo.ownerRepo} ${repo.path} ${repo.tags.join(" ")}`.toLowerCase()
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

function parseUiFlags(args: string[]): { port?: number; noOpen: boolean; dev: boolean } {
  const noOpen = args.includes("--no-open")
  const dev = args.includes("--dev")
  const rawPort = readArgValue(args, "--port")
  if (!rawPort) {
    return { noOpen, dev }
  }
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`无效端口: ${rawPort}`)
  }
  return { noOpen, dev, port }
}

async function runUiServer(
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
  flags: { port?: number; noOpen: boolean; dev: boolean }
): Promise<{ url: string; port: number }> {
  if (flags.dev) {
    const uiPort = await findAvailablePort(flags.port ?? 5173, 30)
    const uiUrl = `http://127.0.0.1:${uiPort}`
    const server = await startWebServer(options, { basePort: 17333, uiPort, uiUrl })
    await startViteDevServer(uiPort, server.apiUrl)
    return { url: uiUrl, port: uiPort }
  }
  const basePort = flags.port ?? 17333
  const server = await startWebServer(options, { basePort })
  return { url: server.url, port: server.port }
}

async function startViteDevServer(port: number, apiUrl: string): Promise<void> {
  const child = execa(
    "npm",
    ["--prefix", "webapp", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      env: {
        ...process.env,
        VITE_API_BASE: `${apiUrl}/api`
      },
      stdio: "ignore",
      reject: false
    }
  )
  child.catch(() => {})
}

async function findAvailablePort(basePort: number, attempts: number): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = basePort + offset
    const available = await isPortAvailable(port)
    if (available) {
      return port
    }
  }
  throw new Error(`未找到可用端口: ${basePort}-${basePort + attempts - 1}`)
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => {
      resolve(false)
    })
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, "127.0.0.1")
  })
}

async function openBrowserOnMac(url: string): Promise<void> {
  if (process.platform !== "darwin") {
    return
  }
  try {
    await execa("open", [url], { stdio: "ignore", reject: false })
  } catch {
    return
  }
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

async function checkFzfAvailable(): Promise<boolean> {
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
    return false
  }
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
  registerBuiltInPlugins(options)
  const actions = getRegisteredActions().filter((action) => isActionAllowed(action, "cli"))
  if (actions.length === 0) {
    return null
  }
  const input = actions.map((item) => `${item.label}\t${item.id}`).join("\n")
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
  return actions.find((item) => item.id === id) ?? null
}

function isActionAllowed(action: Action, scope: "cli" | "web"): boolean {
  if (!action.scopes || action.scopes.length === 0) {
    return true
  }
  return action.scopes.includes(scope)
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
    "  list               输出 repo 列表（支持过滤/排序/格式）",
    "  ui                 启动本地 Web UI",
    "  ui stop            停止 Web UI",
    "  ui restart         重启 Web UI",
    "  status             查看 Web UI 状态",
    "",
    "Options:",
    "  --port <n>         指定 Web UI 端口（若占用会自动递增）",
    "  --no-open          不自动打开浏览器",
    "  --dev              使用前端 dev server",
    "  --config           创建默认配置并输出路径",
    "  --json             输出 JSON（用于 repo list/status）",
    "  --tsv              输出 TSV（用于 repo list）",
    "  --q <text>         关键词过滤（用于 repo list）",
    "  --tag <tag>        tag 过滤（用于 repo list）",
    "  --dirty            仅输出 dirty 仓库（用于 repo list）",
    "  --sort lru|name    排序方式（用于 repo list）",
    "  --list             输出 repo 列表（兼容旧参数）",
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
