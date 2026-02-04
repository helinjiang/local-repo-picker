#!/usr/bin/env node

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import readline from "node:readline/promises"
import { fileURLToPath } from "node:url"
import React from "react"
import { render } from "ink"
import { buildCache, loadCache, refreshCache } from "./core/cache"
import { ensureConfigFile, getConfigPaths, readConfig, writeConfig } from "./config/config"
import { isDebugEnabled, logger } from "./core/logger"
import { RepoPicker } from "./ui/RepoPicker"
import type { RepoInfo } from "./core/types"

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

  if (!config.scanRoots || config.scanRoots.length === 0) {
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

  const listOnly = command === "list" || args.includes("--list")
  const cached = await loadCache(options)
  const resolved = cached ?? (await buildCache(options))
  if (resolved.metadata.warningCount && resolved.metadata.warningCount > 0) {
    console.error(`部分路径被跳过: ${resolved.metadata.warningCount}`)
  }
  if (listOnly || !process.stdout.isTTY) {
    for (const repo of resolved.repos) {
      console.log(repo.path)
    }
    return
  }
  await runTui(resolved.repos, {
    mode: cached ? "cache" : "scan",
    scanDurationMs: resolved.metadata.scanDurationMs,
    warningCount: resolved.metadata.warningCount
  })
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

async function runTui(
  repos: RepoInfo[],
  status: { mode: "cache" | "scan"; scanDurationMs?: number; warningCount?: number }
) {
  let selectedPath: string | null = null
  const app = render(
    React.createElement(RepoPicker, {
      repos,
      status,
      onSelect: (repo) => {
        selectedPath = repo.path
      },
      onCancel: () => {}
    }),
    { patchConsole: false }
  )
  await app.waitUntilExit()
  clearTuiArea()
  if (selectedPath) {
    console.log(selectedPath)
  }
}

function clearTuiArea(): void {
  const rows = process.stdout.rows ?? 24
  process.stdout.write(`\u001b[${rows}A\u001b[0G\u001b[0J`)
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
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const packageFile = path.resolve(currentDir, "../package.json")
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
