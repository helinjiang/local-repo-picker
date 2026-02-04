#!/usr/bin/env node

import { buildCache, loadCache, refreshCache } from "./core/cache.js"
import { ensureConfigFile, getConfigPaths, readConfig } from "./config/config.js"

const args = process.argv.slice(2)
const command = args[0]

if (args.includes("--config")) {
  const configFile = await ensureConfigFile()
  console.log(configFile)
  process.exit(0)
}

const config = await readConfig()
const { cacheFile, manualTagsFile, lruFile, configFile } = getConfigPaths()

if (!config.scanRoots || config.scanRoots.length === 0) {
  console.log(`请在 ${configFile} 配置 scanRoots`)
  process.exit(1)
}

const options = {
  ...config,
  cacheFile,
  manualTagsFile,
  lruFile
}

if (command === "refresh") {
  const cache = await refreshCache(options)
  console.log(`refresh: ${cache.repos.length}`)
  process.exit(0)
}

const cache = (await loadCache(options)) ?? (await buildCache(options))
for (const repo of cache.repos) {
  console.log(repo.path)
}
