import type { RepoInfo, ScanOptions } from "./core/types.js"
import { buildCache, loadCache, refreshCache } from "./core/cache.js"
import { readLru, sortByLru, updateLru } from "./core/lru.js"
import { scanRepos } from "./core/scan.js"
import { RepoPicker } from "./ui/RepoPicker.js"
import { PreviewPanel } from "./ui/PreviewPanel.js"
import { useRepoPreview } from "./ui/useRepoPreview.js"
import {
  ensureConfigFile,
  getConfigPaths,
  readConfig,
  writeConfig
} from "./config/config.js"
import type { AppConfig } from "./config/schema.js"

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
  getConfigPaths,
  readConfig,
  writeConfig,
  ensureConfigFile
}
export type { RepoInfo, ScanOptions, AppConfig }

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
