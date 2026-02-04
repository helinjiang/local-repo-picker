import type { Action, CacheMetadata, RepoInfo, ScanOptions } from "./core/types"
import { buildCache, loadCache, refreshCache } from "./core/cache"
import { readLru, sortByLru, updateLru } from "./core/lru"
import { scanRepos } from "./core/scan"
import { RepoPicker } from "./ui/RepoPicker"
import { PreviewPanel } from "./ui/PreviewPanel"
import { useRepoPreview } from "./ui/useRepoPreview"
import { ErrorBoundary } from "./ui/ErrorBoundary"
import {
  ensureConfigFile,
  getConfigPaths,
  readConfig,
  writeConfig
} from "./config/config"
import type { AppConfig } from "./config/schema"

export {
  buildCache,
  loadCache,
  refreshCache,
  readLru,
  sortByLru,
  updateLru,
  scanRepos,
  RepoPicker,
  PreviewPanel,
  useRepoPreview,
  ErrorBoundary,
  getConfigPaths,
  readConfig,
  writeConfig,
  ensureConfigFile
}
export type { RepoInfo, ScanOptions, AppConfig, CacheMetadata, Action }

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
