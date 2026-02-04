import type { RepoInfo, ScanOptions } from "./core/types.js"
import { buildCache, loadCache, refreshCache } from "./core/cache.js"
import { readLru, sortByLru, updateLru } from "./core/lru.js"
import { scanRepos } from "./core/scan.js"
import { RepoPicker } from "./ui/RepoPicker.js"

export { buildCache, loadCache, refreshCache, readLru, sortByLru, updateLru, scanRepos, RepoPicker }
export type { RepoInfo, ScanOptions }

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
