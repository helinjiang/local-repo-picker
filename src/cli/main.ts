import { refreshCache } from "../core/cache"
import { ensureConfigFile, getConfigPaths, readConfig } from "../config/config"
import { logger } from "../core/logger"
import { printHelp, readPackageVersion } from "./help"
import { runStatus, runUiCommand, parseUiFlags, runUiServer } from "./ui"
import { runListCommand, runInternalList } from "./list"
import { runInternalPreview } from "./preview"
import { runOneCommand } from "./one"
import { runSetupWizard } from "./setup"
import { formatError } from "./errors"

export async function runCli(): Promise<void> {
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
    await runUiCommand(args)
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
    let uiFlags
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

  if (command === "one") {
    await runOneCommand(options)
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
