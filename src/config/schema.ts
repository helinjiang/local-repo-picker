export type AppConfig = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  followSymlinks?: boolean
  fzfTagFilters?: Record<string, string>
  webQuickTags?: string[]
  webRepoLinks?: Record<string, { label: string; url: string }[]>
}
