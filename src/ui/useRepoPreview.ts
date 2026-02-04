import { promises as fs } from "node:fs"
import path from "node:path"
import { useEffect, useRef, useState } from "react"
import type { RepoInfo } from "../core/types"
import { checkGitAvailable, isDirty, readOriginUrl, resolveGitDir, runGit, type GitErrorKind } from "../core/git"

type RepoPreviewResult = {
  data: RepoPreview
  error?: string
}

const cache = new Map<string, RepoPreviewResult>()
const inFlight = new Map<string, Promise<RepoPreviewResult>>()

export type RepoPreview = {
  path: string
  origin: string
  branch: string
  status: "dirty" | "clean"
  sync: string
  recentCommits: string[]
  readme: string[]
  readmeStatus: "ok" | "missing" | "unavailable"
}

export type PreviewState = {
  loading: boolean
  data: RepoPreview | null
  error?: string
}

export function useRepoPreview(repo: RepoInfo | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ loading: false, data: null })
  const requestIdRef = useRef(0)
  const currentPathRef = useRef<string | null>(null)

  useEffect(() => {
    const repoPath = repo?.path
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    currentPathRef.current = repoPath ?? null
    if (!repoPath) {
      setState({ loading: false, data: null })
      return
    }
    const cached = cache.get(repoPath)
    if (cached) {
      setState({ loading: false, data: cached.data, error: cached.error })
      return
    }
    setState({ loading: true, data: null })
    const timer = setTimeout(() => {
      const pending = inFlight.get(repoPath) ?? fetchPreview(repoPath)
      inFlight.set(repoPath, pending)
      pending.then((result) => {
        cache.set(repoPath, result)
        inFlight.delete(repoPath)
        if (requestId === requestIdRef.current && currentPathRef.current === repoPath) {
          setState({ loading: false, data: result.data, error: result.error })
        }
      })
    }, 120)
    return () => {
      clearTimeout(timer)
    }
  }, [repo?.path])

  return state
}

async function fetchPreview(repoPath: string): Promise<RepoPreviewResult> {
  const accessible = await fs.access(repoPath).then(() => true, () => false)
  if (!accessible) {
    return {
      data: {
        path: repoPath,
        origin: "-",
        branch: "-",
        status: "clean",
        sync: "-",
        recentCommits: [],
        readme: [],
        readmeStatus: "unavailable"
      },
      error: "Repository not accessible"
    }
  }
  const gitDir = await resolveGitDir(repoPath)
  if (!gitDir) {
    const readme = await readReadme(repoPath)
    return {
      data: {
        path: repoPath,
        origin: "-",
        branch: "-",
        status: "clean",
        sync: "-",
        recentCommits: [],
        readme: readme.lines,
        readmeStatus: readme.status
      },
      error: "Repository not accessible"
    }
  }
  const gitAvailable = await checkGitAvailable()
  if (!gitAvailable) {
    const readme = await readReadme(repoPath)
    return {
      data: {
        path: repoPath,
        origin: "-",
        branch: "-",
        status: "clean",
        sync: "-",
        recentCommits: [],
        readme: readme.lines,
        readmeStatus: readme.status
      },
      error: "Git not available"
    }
  }
  const [origin, branch, status, sync, recentCommits, readme] = await Promise.all([
    getOrigin(repoPath),
    getBranch(repoPath),
    getStatus(repoPath),
    getSync(repoPath),
    getRecentCommits(repoPath),
    readReadme(repoPath)
  ])
  const error = pickPreviewError([
    origin.errorKind,
    branch.errorKind,
    sync.errorKind,
    recentCommits.errorKind
  ])
  return {
    data: {
      path: repoPath,
      origin: origin.value,
      branch: branch.value,
      status,
      sync: sync.value,
      recentCommits: recentCommits.value,
      readme: readme.lines,
      readmeStatus: readme.status
    },
    error
  }
}

async function getOrigin(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const fromConfig = await readOriginUrl(repoPath)
  if (fromConfig) {
    return { value: fromConfig }
  }
  const result = await runGit(["config", "--get", "remote.origin.url"], {
    cwd: repoPath,
    timeoutMs: 1500
  })
  if (!result.ok) {
    return { value: "-", errorKind: result.kind }
  }
  return { value: result.stdout.trim() || "-" }
}

async function getBranch(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const result = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoPath,
    timeoutMs: 1500
  })
  if (!result.ok) {
    return { value: "-", errorKind: result.kind }
  }
  return { value: result.stdout.trim() || "-" }
}

async function getStatus(repoPath: string): Promise<"dirty" | "clean"> {
  const dirty = await isDirty(repoPath, 1500)
  return dirty ? "dirty" : "clean"
}

async function getSync(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const result = await runGit(
    ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    { cwd: repoPath, timeoutMs: 2000 }
  )
  if (!result.ok) {
    return { value: "-", errorKind: result.kind }
  }
  const [aheadRaw, behindRaw] = result.stdout.trim().split(/\s+/)
  const ahead = Number(aheadRaw ?? 0)
  const behind = Number(behindRaw ?? 0)
  return { value: `ahead ${ahead} / behind ${behind}` }
}

async function getRecentCommits(
  repoPath: string
): Promise<{ value: string[]; errorKind?: GitErrorKind }> {
  const result = await runGit(
    ["log", "-n", "12", "--date=iso", "--pretty=format:%cd %h %s"],
    { cwd: repoPath, timeoutMs: 2000 }
  )
  if (!result.ok) {
    return { value: [], errorKind: result.kind }
  }
  return {
    value: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
}

async function readReadme(
  repoPath: string
): Promise<{ lines: string[]; status: "ok" | "missing" | "unavailable" }> {
  const candidates = ["README.md", "README.MD", "README"]
  for (const name of candidates) {
    const filePath = path.join(repoPath, name)
    try {
      const content = await fs.readFile(filePath, "utf8")
      const lines = content.split(/\r?\n/).slice(0, 200)
      return { lines, status: "ok" }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err?.code && err.code !== "ENOENT") {
        return { lines: [], status: "unavailable" }
      }
      continue
    }
  }
  return { lines: [], status: "missing" }
}

function pickPreviewError(errors: Array<GitErrorKind | undefined>): string | undefined {
  if (errors.includes("not_found")) {
    return "Git not available"
  }
  if (errors.includes("not_repo")) {
    return "Repository not accessible"
  }
  if (errors.includes("timeout")) {
    return "Git 超时，预览信息已降级"
  }
  if (errors.includes("unknown")) {
    return "Git 预览失败，已降级展示"
  }
  return undefined
}
