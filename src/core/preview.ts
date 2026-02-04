import { promises as fs } from "node:fs"
import path from "node:path"
import type { RepoInfo, RepoPreview } from "./types"
import { checkGitAvailable, isDirty, readOriginUrl, resolveGitDir, runGit, type GitErrorKind } from "./git"
import { resolvePreviewExtensions } from "./plugins"

export type RepoPreviewResult = {
  data: RepoPreview
  error?: string
}

export async function buildRepoPreview(repo: RepoInfo): Promise<RepoPreviewResult> {
  const repoPath = repo.path
  const accessible = await fs.access(repoPath).then(() => true, () => false)
  if (!accessible) {
    return buildFallbackPreview(repoPath, "Repository not accessible")
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
        readmeStatus: readme.status,
        extensions: []
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
        readmeStatus: readme.status,
        extensions: []
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
  const basePreview: RepoPreview = {
    path: repoPath,
    origin: origin.value,
    branch: branch.value,
    status,
    sync: sync.value,
    recentCommits: recentCommits.value,
    readme: readme.lines,
    readmeStatus: readme.status,
    extensions: []
  }
  const extensions = await resolvePreviewExtensions({ repo, preview: basePreview })
  return {
    data: { ...basePreview, extensions },
    error
  }
}

export function buildFallbackPreview(repoPath: string, error: string): RepoPreviewResult {
  return {
    data: {
      path: repoPath,
      origin: "-",
      branch: "-",
      status: "clean",
      sync: "-",
      recentCommits: [],
      readme: [],
      readmeStatus: "unavailable",
      extensions: []
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
  if (errors.includes("not_allowed")) {
    return "Git 命令未获允许，预览信息已降级"
  }
  if (errors.includes("unknown")) {
    return "Git 预览失败，已降级展示"
  }
  return undefined
}
