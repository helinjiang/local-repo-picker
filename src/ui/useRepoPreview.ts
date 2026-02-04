import { promises as fs } from "node:fs"
import path from "node:path"
import { useEffect, useRef, useState } from "react"
import type { RepoInfo } from "../core/types"
import { checkGitAvailable, isDirty, readOriginUrl, runGit, type GitErrorKind } from "../core/git"

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
}

export type PreviewState = {
  loading: boolean
  data: RepoPreview | null
  error?: string
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
        if (requestId === requestIdRef.current) {
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
        readme
      },
      error: "Git 不可用，预览信息已降级"
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
      readme
    },
    error
  }
}

async function getOrigin(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const fromConfig = await readOriginUrl(repoPath)
  if (fromConfig) {
    return { value: fromConfig }
  }
  const result = await runGit(["config", "--get", "remote.origin.url"], { cwd: repoPath })
  if (!result.ok) {
    return { value: "-", errorKind: result.kind }
  }
  return { value: result.stdout.trim() || "-" }
}

async function getBranch(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const result = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath })
  if (!result.ok) {
    return { value: "-", errorKind: result.kind }
  }
  return { value: result.stdout.trim() || "-" }
}

async function getStatus(repoPath: string): Promise<"dirty" | "clean"> {
  const dirty = await isDirty(repoPath)
  return dirty ? "dirty" : "clean"
}

async function getSync(repoPath: string): Promise<{ value: string; errorKind?: GitErrorKind }> {
  const result = await runGit(
    ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    { cwd: repoPath }
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
    { cwd: repoPath }
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

function pickPreviewError(errors: Array<GitErrorKind | undefined>): string | undefined {
  if (errors.includes("not_found")) {
    return "Git 不可用，预览信息已降级"
  }
  if (errors.includes("not_repo")) {
    return "仓库不可用或不是 Git 仓库"
  }
  if (errors.includes("unknown")) {
    return "Git 预览失败，已降级展示"
  }
  return undefined
}
