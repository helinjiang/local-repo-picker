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
  repos: RepoInfo[]
}

export type FoundRepo = {
  path: string
  scanRoot: string
  autoTag?: string
}
