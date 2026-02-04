import { promises as fs } from "node:fs"
import path from "node:path"
import type { FoundRepo, ScanOptions } from "./types"

const defaultMaxDepth = 7

export async function scanRepos(
  options: ScanOptions
): Promise<FoundRepo[]> {
  const scanRoots = options.scanRoots.map((root) => path.resolve(root))
  const maxDepth = options.maxDepth ?? defaultMaxDepth
  const pruneDirs = new Set(options.pruneDirs ?? [])
  const results: FoundRepo[] = []
  for (const root of scanRoots) {
    await walkRoot(root, root, 0, maxDepth, pruneDirs, results)
  }
  return results
}

async function walkRoot(
  root: string,
  current: string,
  depth: number,
  maxDepth: number,
  pruneDirs: Set<string>,
  results: FoundRepo[]
): Promise<void> {
  if (depth > maxDepth) {
    return
  }
  let entries
  try {
    entries = await fs.readdir(current, { withFileTypes: true })
  } catch {
    return
  }
  const hasGit = entries.some((entry) => entry.name === ".git")
  if (hasGit) {
    const autoTag = getAutoTag(root, current)
    results.push({ path: current, scanRoot: root, autoTag })
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name === ".git") {
      continue
    }
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
      continue
    }
    if (pruneDirs.has(entry.name)) {
      continue
    }
    await walkRoot(
      root,
      path.join(current, entry.name),
      depth + 1,
      maxDepth,
      pruneDirs,
      results
    )
  }
}

function getAutoTag(scanRoot: string, repoPath: string): string | undefined {
  const rel = path.relative(scanRoot, repoPath)
  if (!rel || rel === "") {
    return undefined
  }
  const first = rel.split(path.sep).filter(Boolean)[0]
  if (!first) {
    return undefined
  }
  return `[${first}]`
}
