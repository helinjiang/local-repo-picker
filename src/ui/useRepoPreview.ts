import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { useEffect, useRef, useState } from "react"
import pLimit from "p-limit"
import type { RepoInfo } from "../core/types.js"
import { isDirty, readOriginUrl } from "../core/git.js"

const execFileAsync = promisify(execFile)
const gitLimit = pLimit(4)
const cache = new Map<string, RepoPreview>()
const inFlight = new Map<string, Promise<RepoPreview>>()

export type RepoPreview = {
  path: string
  origin: string
  branch: string
  status: "dirty" | "clean"
  sync: string
  recentCommits: string[]
  readme: string[]
}

export type PreviewState = {
  loading: boolean
  data: RepoPreview | null
}

export function useRepoPreview(repo: RepoInfo | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ loading: false, data: null })
  const requestIdRef = useRef(0)

  useEffect(() => {
    const repoPath = repo?.path
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    if (!repoPath) {
      setState({ loading: false, data: null })
      return
    }
    const cached = cache.get(repoPath)
    if (cached) {
      setState({ loading: false, data: cached })
      return
    }
    setState({ loading: true, data: null })
    const timer = setTimeout(() => {
      const pending = inFlight.get(repoPath) ?? fetchPreview(repoPath)
      inFlight.set(repoPath, pending)
      pending.then((data) => {
        cache.set(repoPath, data)
        inFlight.delete(repoPath)
        if (requestId === requestIdRef.current) {
          setState({ loading: false, data })
        }
      })
    }, 120)
    return () => {
      clearTimeout(timer)
    }
  }, [repo?.path])

  return state
}

async function fetchPreview(repoPath: string): Promise<RepoPreview> {
  const [origin, branch, status, sync, recentCommits, readme] = await Promise.all([
    getOrigin(repoPath),
    getBranch(repoPath),
    getStatus(repoPath),
    getSync(repoPath),
    getRecentCommits(repoPath),
    readReadme(repoPath)
  ])
  return { path: repoPath, origin, branch, status, sync, recentCommits, readme }
}

async function getOrigin(repoPath: string): Promise<string> {
  const fromConfig = await readOriginUrl(repoPath)
  if (fromConfig) {
    return fromConfig
  }
  try {
    const { stdout } = await gitLimit(() =>
      execFileAsync("git", ["-C", repoPath, "config", "--get", "remote.origin.url"])
    )
    return stdout.trim() || "-"
  } catch {
    return "-"
  }
}

async function getBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await gitLimit(() =>
      execFileAsync("git", ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"])
    )
    return stdout.trim() || "-"
  } catch {
    return "-"
  }
}

async function getStatus(repoPath: string): Promise<"dirty" | "clean"> {
  const dirty = await isDirty(repoPath)
  return dirty ? "dirty" : "clean"
}

async function getSync(repoPath: string): Promise<string> {
  try {
    const { stdout } = await gitLimit(() =>
      execFileAsync("git", [
        "-C",
        repoPath,
        "rev-list",
        "--left-right",
        "--count",
        "HEAD...@{upstream}"
      ])
    )
    const [aheadRaw, behindRaw] = stdout.trim().split(/\s+/)
    const ahead = Number(aheadRaw ?? 0)
    const behind = Number(behindRaw ?? 0)
    return `ahead ${ahead} / behind ${behind}`
  } catch {
    return "-"
  }
}

async function getRecentCommits(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await gitLimit(() =>
      execFileAsync("git", [
        "-C",
        repoPath,
        "log",
        "-n",
        "12",
        "--date=iso",
        "--pretty=format:%cd %h %s"
      ])
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function readReadme(repoPath: string): Promise<string[]> {
  const candidates = ["README.md", "README.MD", "README"]
  for (const name of candidates) {
    const filePath = path.join(repoPath, name)
    try {
      const content = await fs.readFile(filePath, "utf8")
      const lines = content.split(/\r?\n/).slice(0, 200)
      return lines
    } catch {
      continue
    }
  }
  return []
}
