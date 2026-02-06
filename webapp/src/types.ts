export type RepoItem = {
  path: string
  ownerRepo: string
  tags: string[]
  manualTags?: string[]
  lastScannedAt: number
  isDirty?: boolean
}

export type RepoListResult = {
  items: RepoItem[]
  total: number
  page: number
  pageSize: number
}

export type PreviewSection = {
  title: string
  lines: string[]
}

export type RepoPreview = {
  path: string
  repoPath: string
  repoKey: string
  origin: string
  siteUrl: string
  branch: string
  status: "dirty" | "clean"
  sync: string
  recentCommits: string[]
  readme: string[]
  readmeStatus: "ok" | "missing" | "unavailable"
  extensions: PreviewSection[]
}

export type RepoPreviewResult = {
  data: RepoPreview
  error?: string
}

export type FixedLink = {
  label: string
  url: string
}

export type AppConfig = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  followSymlinks?: boolean
  fzfTagFilters?: Record<string, string>
  webQuickTags?: string[]
  webRepoLinks?: Record<string, FixedLink[]>
  remoteHostTags?: Record<string, string>
}

export type ConfigPaths = {
  configDir: string
  dataDir: string
  cacheDir: string
  configFile: string
  cacheFile: string
  manualTagsFile: string
  lruFile: string
}

export type ConfigResponse = {
  config: AppConfig
  paths: ConfigPaths
}

export type SaveConfigResponse = {
  ok: boolean
  config: AppConfig
  repoCount: number
}

export type ActionInfo = {
  id: string
  label: string
}
