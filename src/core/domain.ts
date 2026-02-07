import path from "node:path"
import type { GitProvider, GitRepository, RepositoryRecord } from "./types"
import { parseOriginInfo } from "./git"

type GitProviderInfo = { provider: GitProvider; baseUrl: string }

export function buildGitRepository(originUrl?: string | null, fallbackFullName?: string): GitRepository | undefined {
  if (!originUrl) {
    return undefined
  }
  const { host, ownerRepo } = parseOriginInfo(originUrl)
  if (!host) {
    return undefined
  }
  const fullName = ownerRepo || (fallbackFullName?.trim() ?? "")
  const providerInfo = resolveProviderInfo(host)
  const { namespace, repo } = splitFullName(fullName)
  const isValid = Boolean(fullName && namespace && repo)
  return {
    provider: providerInfo.provider,
    namespace,
    repo,
    fullName,
    baseUrl: providerInfo.baseUrl,
    originUrl,
    isValid
  }
}

export function buildRecordKey(input: { git?: GitRepository; relativePath: string }): string {
  if (input.git?.fullName) {
    return `${input.git.provider}:${input.git.fullName}`
  }
  if (input.relativePath) {
    return `local:${input.relativePath}`
  }
  return "-"
}

export function buildRepositoryRecord(input: {
  fullPath: string
  scanRoot: string
  relativePath?: string
  git?: GitRepository
  isDirty: boolean
  manualTags?: string[]
  autoTags?: string[]
  lastScannedAt: number
}): RepositoryRecord {
  const relativePath = input.relativePath ?? deriveRelativePath(input.fullPath, input.scanRoot)
  const recordKey = buildRecordKey({ git: input.git, relativePath })
  return {
    fullPath: input.fullPath,
    scanRoot: input.scanRoot,
    relativePath,
    recordKey,
    git: input.git,
    isDirty: input.isDirty,
    manualTags: input.manualTags ?? [],
    autoTags: input.autoTags ?? [],
    lastScannedAt: input.lastScannedAt
  }
}

export function deriveRelativePath(fullPath: string, scanRoot: string): string {
  const resolvedPath = path.resolve(fullPath)
  const resolvedRoot = path.resolve(scanRoot)
  if (resolvedPath === resolvedRoot) {
    return path.basename(resolvedPath)
  }
  if (resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    const relative = path.relative(resolvedRoot, resolvedPath)
    return relative || path.basename(resolvedPath)
  }
  return path.basename(resolvedPath)
}

function splitFullName(fullName: string): { namespace: string; repo: string } {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { namespace: "", repo: "" }
  }
  const parts = trimmed.split("/").filter(Boolean)
  if (parts.length >= 2) {
    return { namespace: parts[parts.length - 2], repo: parts[parts.length - 1] }
  }
  return { namespace: "", repo: parts[0] ?? "" }
}

function resolveProviderInfo(host: string): GitProviderInfo {
  if (host === "github.com") {
    return { provider: "github", baseUrl: "https://github.com" }
  }
  if (host === "gitee.com") {
    return { provider: "gitee", baseUrl: "https://gitee.com" }
  }
  if (host === "gitlab.com") {
    return { provider: "gitlab", baseUrl: "https://gitlab.com" }
  }
  if (host === "bitbucket.org") {
    return { provider: "bitbucket", baseUrl: "https://bitbucket.org" }
  }
  if (host === "dev.azure.com" || host.endsWith(".visualstudio.com")) {
    return { provider: "azure", baseUrl: `https://${host}` }
  }
  return { provider: "unknown", baseUrl: `https://${host}` }
}
