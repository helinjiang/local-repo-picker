import path from "node:path"
import { promises as fs } from "node:fs"
import envPaths from "env-paths"
import type { AppConfig } from "./schema"
import { defaultConfig } from "./defaults"

export type ConfigPaths = {
  configDir: string
  dataDir: string
  cacheDir: string
  configFile: string
  cacheFile: string
  manualTagsFile: string
  lruFile: string
}

let overridePaths: ConfigPaths | null = null

export function getConfigPaths(): ConfigPaths {
  if (overridePaths) {
    return overridePaths
  }
  const customBase = process.env.LOCAL_REPO_PICKER_DIR
  if (customBase && customBase.trim()) {
    overridePaths = buildPathsFromBase(customBase.trim())
    return overridePaths
  }
  const paths = envPaths("local-repo-picker")
  return buildPathsFromEnv(paths)
}

export async function ensureConfigFile(): Promise<string> {
  let { configDir, configFile } = getConfigPaths()
  try {
    await fs.mkdir(configDir, { recursive: true })
  } catch {
    overridePaths = buildPathsFromBase(path.join(process.cwd(), ".local-repo-picker"))
    ;({ configDir, configFile } = overridePaths)
    await fs.mkdir(configDir, { recursive: true })
  }
  if (!(await exists(configFile))) {
    await fs.writeFile(configFile, JSON.stringify(defaultConfig, null, 2), "utf8")
  }
  return configFile
}

export async function readConfig(): Promise<AppConfig> {
  const { configFile } = getConfigPaths()
  try {
    const content = await fs.readFile(configFile, "utf8")
    return normalizeConfig(JSON.parse(content))
  } catch {
    await ensureConfigFile()
    return { ...defaultConfig }
  }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  let { configDir, configFile } = getConfigPaths()
  try {
    await fs.mkdir(configDir, { recursive: true })
  } catch {
    overridePaths = buildPathsFromBase(path.join(process.cwd(), ".local-repo-picker"))
    ;({ configDir, configFile } = overridePaths)
    await fs.mkdir(configDir, { recursive: true })
  }
  const normalized = normalizeConfig(config)
  await fs.writeFile(configFile, JSON.stringify(normalized, null, 2), "utf8")
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function normalizeConfig(raw: unknown): AppConfig {
  const value =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  const scanRoots = Array.isArray(value.scanRoots)
    ? value.scanRoots.filter((item) => typeof item === "string")
    : defaultConfig.scanRoots
  const maxDepth =
    typeof value.maxDepth === "number" ? value.maxDepth : defaultConfig.maxDepth
  const pruneDirs = Array.isArray(value.pruneDirs)
    ? value.pruneDirs.filter((item) => typeof item === "string")
    : defaultConfig.pruneDirs
  const cacheTtlMs =
    typeof value.cacheTtlMs === "number"
      ? value.cacheTtlMs
      : defaultConfig.cacheTtlMs
  const followSymlinks =
    typeof value.followSymlinks === "boolean"
      ? value.followSymlinks
      : defaultConfig.followSymlinks
  const fzfTagFilters =
    typeof value.fzfTagFilters === "object" && value.fzfTagFilters !== null
      ? (Object.fromEntries(
          Object.entries(value.fzfTagFilters as Record<string, unknown>)
            .filter(([key, item]) => typeof key === "string" && typeof item === "string")
        ) as Record<string, string>)
      : defaultConfig.fzfTagFilters
  return {
    scanRoots,
    maxDepth,
    pruneDirs,
    cacheTtlMs,
    followSymlinks,
    fzfTagFilters
  }
}

function buildPathsFromEnv(paths: { config: string; data: string; cache: string }): ConfigPaths {
  return {
    configDir: paths.config,
    dataDir: paths.data,
    cacheDir: paths.cache,
    configFile: path.join(paths.config, "config.json"),
    cacheFile: path.join(paths.cache, "cache.json"),
    manualTagsFile: path.join(paths.data, "repo_tags.tsv"),
    lruFile: path.join(paths.data, "lru.txt")
  }
}

function buildPathsFromBase(baseDir: string): ConfigPaths {
  const configDir = path.join(baseDir, "config")
  const dataDir = path.join(baseDir, "data")
  const cacheDir = path.join(baseDir, "cache")
  return {
    configDir,
    dataDir,
    cacheDir,
    configFile: path.join(configDir, "config.json"),
    cacheFile: path.join(cacheDir, "cache.json"),
    manualTagsFile: path.join(dataDir, "repo_tags.tsv"),
    lruFile: path.join(dataDir, "lru.txt")
  }
}
