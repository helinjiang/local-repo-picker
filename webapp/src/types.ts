export type RepoItem = {
  path: string
  ownerRepo: string
  tags: string[]
  lastScannedAt: number
  isDirty?: boolean
}

export type RepoListResult = {
  items: RepoItem[]
  total: number
  page: number
  pageSize: number
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
  origin: string
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
