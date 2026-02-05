import { readOriginUrl, runGit } from "./git"

export async function readOriginValue(repoPath: string): Promise<string | null> {
  const fromConfig = await readOriginUrl(repoPath)
  if (fromConfig) {
    return fromConfig
  }
  const result = await runGit(["config", "--get", "remote.origin.url"], {
    cwd: repoPath,
    timeoutMs: 1500
  })
  if (!result.ok) {
    return null
  }
  const value = result.stdout.trim()
  return value ? value : null
}

export function parseOriginToSiteUrl(origin: string | null | undefined): string | null {
  if (!origin || origin === "-") {
    return null
  }
  if (origin.includes("://")) {
    try {
      const url = new URL(origin)
      const repoPath = normalizeRepoPath(url.pathname)
      if (!repoPath || !url.hostname) {
        return null
      }
      return `https://${url.hostname}/${repoPath}`
    } catch {
      return null
    }
  }
  const scpMatch = origin.match(/^(?:.+@)?([^:]+):(.+)$/)
  if (!scpMatch) {
    return null
  }
  const repoPath = normalizeRepoPath(scpMatch[2])
  if (!repoPath) {
    return null
  }
  return `https://${scpMatch[1]}/${repoPath}`
}

function normalizeRepoPath(input: string): string {
  return input.replace(/^\/+/, "").replace(/\.git$/i, "")
}
