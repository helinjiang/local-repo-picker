import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { promises as fs } from "node:fs"
import path from "node:path"

const execFileAsync = promisify(execFile)

export async function resolveGitDir(repoPath: string): Promise<string | null> {
  const dotGitPath = path.join(repoPath, ".git")
  try {
    const stat = await fs.stat(dotGitPath)
    if (stat.isDirectory()) {
      return dotGitPath
    }
    if (stat.isFile()) {
      const content = await fs.readFile(dotGitPath, "utf8")
      const match = content.match(/gitdir:\s*(.+)\s*$/m)
      if (!match) {
        return null
      }
      const gitdir = match[1].trim()
      if (path.isAbsolute(gitdir)) {
        return gitdir
      }
      return path.resolve(repoPath, gitdir)
    }
  } catch {
    return null
  }
  return null
}

export async function readOriginUrl(repoPath: string): Promise<string | null> {
  const gitDir = await resolveGitDir(repoPath)
  if (!gitDir) {
    return null
  }
  const configPath = path.join(gitDir, "config")
  try {
    const content = await fs.readFile(configPath, "utf8")
    const lines = content.split(/\r?\n/)
    let inOrigin = false
    for (const line of lines) {
      const sectionMatch = line.match(/^\s*\[(.+?)\]\s*$/)
      if (sectionMatch) {
        inOrigin = sectionMatch[1] === 'remote "origin"'
        continue
      }
      if (!inOrigin) {
        continue
      }
      const urlMatch = line.match(/^\s*url\s*=\s*(.+)\s*$/)
      if (urlMatch) {
        return urlMatch[1].trim()
      }
    }
  } catch {
    return null
  }
  return null
}

export function parseOriginInfo(originUrl: string | null): {
  host?: string
  ownerRepo: string
} {
  if (!originUrl) {
    return { ownerRepo: "" }
  }
  let host: string | undefined
  let repoPath = ""
  if (originUrl.includes("://")) {
    try {
      const url = new URL(originUrl)
      host = url.hostname
      repoPath = url.pathname
    } catch {
      return { ownerRepo: "" }
    }
  } else {
    const scpMatch = originUrl.match(/^(?:.+@)?([^:]+):(.+)$/)
    if (scpMatch) {
      host = scpMatch[1]
      repoPath = scpMatch[2]
    } else {
      return { ownerRepo: "" }
    }
  }
  const trimmed = repoPath.replace(/^\//, "").replace(/\.git$/, "")
  const parts = trimmed.split("/").filter(Boolean)
  let ownerRepo = trimmed
  if (parts.length >= 2) {
    ownerRepo = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  return { host, ownerRepo }
}

export async function isDirty(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      repoPath,
      "status",
      "--porcelain"
    ])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}
