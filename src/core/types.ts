export type RepoInfo = {
  path: string
  ownerRepo: string
  originUrl?: string
  tags: string[]
  lastScannedAt: number
}

export type ScanOptions = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  cacheFile?: string
  manualTagsFile?: string
  lruFile?: string
  lruLimit?: number
}

export type CacheData = {
  savedAt: number
  ttlMs: number
  metadata: CacheMetadata
  repos: RepoInfo[]
}

export type CacheMetadata = {
  cacheVersion: number
  scanStartedAt: number
  scanFinishedAt: number
  scanDurationMs: number
  buildDurationMs: number
  repoCount: number
  scanRoots: string[]
  prunedAt?: number
  prunedRepoCount?: number
}

export type FoundRepo = {
  path: string
  scanRoot: string
  autoTag?: string
}

export type Action = {
  id: string
  label: string
  run: (repo: RepoInfo) => Promise<void>
}
