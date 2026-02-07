import type {
  Action,
  CacheMetadata,
  GitProvider,
  GitRepository,
  PluginModule,
  PreviewPlugin,
  PreviewSection,
  RepositoryRecord,
  RepoInfo,
  RepoPreview,
  ScanOptions,
  TagPlugin
} from "./core/types"
import { buildCache, loadCache, refreshCache } from "./core/cache"
import { readLru, sortByLru, updateLru } from "./core/lru"
import { scanRepos } from "./core/scan"
import {
  buildGitRepository,
  buildRecordKey,
  buildRepositoryRecord,
  deriveRelativePath
} from "./core/domain"
import {
  clearPlugins,
  getRegisteredActions,
  getRegisteredPlugins,
  loadPlugins,
  registerPlugin,
  registerPlugins
} from "./core/plugins"
import {
  ensureConfigFile,
  getConfigPaths,
  readConfig,
  writeConfig
} from "./config/config"
import type { AppConfig } from "./config/schema"
import { builtInPlugins, registerBuiltInPlugins } from "./plugins/built-in"

export {
  buildCache,
  loadCache,
  refreshCache,
  readLru,
  sortByLru,
  updateLru,
  scanRepos,
  registerPlugin,
  registerPlugins,
  loadPlugins,
  getRegisteredPlugins,
  getRegisteredActions,
  clearPlugins,
  builtInPlugins,
  registerBuiltInPlugins,
  getConfigPaths,
  readConfig,
  writeConfig,
  ensureConfigFile
}
export {
  buildGitRepository,
  buildRecordKey,
  buildRepositoryRecord,
  deriveRelativePath
}
export type {
  RepoInfo,
  ScanOptions,
  AppConfig,
  CacheMetadata,
  Action,
  TagPlugin,
  PreviewPlugin,
  PreviewSection,
  RepoPreview,
  PluginModule,
  GitProvider,
  GitRepository,
  RepositoryRecord
}

export default async function pickRepo(
  options: ScanOptions & { refresh?: boolean }
): Promise<RepoInfo[]> {
  if (options.refresh) {
    const cache = await refreshCache(options)
    return cache.repos
  }
  const cached = await loadCache(options)
  if (cached) {
    return cached.repos
  }
  const cache = await buildCache(options)
  return cache.repos
}
