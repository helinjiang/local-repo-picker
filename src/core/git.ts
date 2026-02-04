import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { promises as fs } from "node:fs"
import path from "node:path"
import pLimit from "p-limit"
import { isDebugEnabled, logger } from "./logger"

const execFileAsync = promisify(execFile)
const gitLimit = pLimit(6)
let gitAvailableCache: boolean | null = null

export type GitErrorKind = "not_found" | "not_repo" | "unknown"

export type GitResult =
  | { ok: true; stdout: string }
  | { ok: false; kind: GitErrorKind; message: string }

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

export async function runGit(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<GitResult> {
  const gitArgs = options.cwd ? ["-C", options.cwd, ...args] : args
  const start = Date.now()
  try {
    const { stdout } = await gitLimit(() =>
      execFileAsync("git", gitArgs, { timeout: options.timeoutMs })
    )
    if (isDebugEnabled()) {
      logger.debug(`git ${gitArgs.join(" ")} ${Date.now() - start}ms`)
    }
    return { ok: true, stdout }
  } catch (error) {
    const kind = parseGitError(error)
    const message = getGitErrorMessage(kind, error)
    if (isDebugEnabled()) {
      logger.debug(`git ${gitArgs.join(" ")} failed ${Date.now() - start}ms ${message}`)
    }
    return { ok: false, kind, message }
  }
}

export async function checkGitAvailable(): Promise<boolean> {
  if (gitAvailableCache !== null) {
    return gitAvailableCache
  }
  const result = await runGit(["--version"])
  gitAvailableCache = result.ok
  return gitAvailableCache
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
  const result = await runGit(["status", "--porcelain"], { cwd: repoPath })
  if (!result.ok) {
    return false
  }
  return result.stdout.trim().length > 0
}

function parseGitError(error: unknown): GitErrorKind {
  const err = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string }
  if (err?.code === "ENOENT") {
    return "not_found"
  }
  const message = `${err?.stderr ?? ""}\n${err?.message ?? ""}`.toLowerCase()
  if (message.includes("not a git repository")) {
    return "not_repo"
  }
  return "unknown"
}

function getGitErrorMessage(kind: GitErrorKind, error: unknown): string {
  if (kind === "not_found") {
    return "git not found"
  }
  if (kind === "not_repo") {
    return "not a git repository"
  }
  const err = error as NodeJS.ErrnoException
  return err?.message ?? "git failed"
}
