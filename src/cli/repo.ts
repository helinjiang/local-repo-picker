import path from "node:path"
import { loadCache } from "../core/cache"
import { normalizeRepoKey } from "../core/path-utils"
import type { RepoInfo } from "../core/types"
import { getCodePlatform } from "../core/tags"
import type { CliOptions } from "./types"

export async function resolveRepoInfo(options: CliOptions, repoPath: string): Promise<RepoInfo> {
  const cached = await loadCache(options)
  const targetKey = normalizeRepoKey(repoPath)
  const found = cached?.repos.find((repo) => normalizeRepoKey(repo.path) === targetKey)
  if (found) {
    return found
  }
  return {
    path: repoPath,
    ownerRepo: path.basename(repoPath),
    codePlatform: getCodePlatform(),
    tags: [],
    lastScannedAt: Date.now()
  }
}
