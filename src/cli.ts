#!/usr/bin/env node

import { buildCache, loadCache, refreshCache } from "./core/cache"
import { ensureConfigFile, getConfigPaths, readConfig } from "./config/config"
import { isDebugEnabled, logger } from "./core/logger"

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

  if (args.includes("--config")) {
    const configFile = await ensureConfigFile()
    console.log(configFile)
    return
  }

  const config = await readConfig()
  const { cacheFile, manualTagsFile, lruFile, configFile } = getConfigPaths()

  if (!config.scanRoots || config.scanRoots.length === 0) {
    logger.error(`请在 ${configFile} 配置 scanRoots`)
    process.exitCode = 1
    return
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

  const cache = (await loadCache(options)) ?? (await buildCache(options))
  if (cache.metadata.warningCount && cache.metadata.warningCount > 0) {
    console.error(`部分路径被跳过: ${cache.metadata.warningCount}`)
  }
  for (const repo of cache.repos) {
    console.log(repo.path)
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
