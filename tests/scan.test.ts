import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { scanRepos } from "../src/core/scan"
import type { ScanWarning } from "../src/core/types"

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })))
  createdDirs.length = 0
})

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-"))
  createdDirs.push(dir)
  return dir
}

async function makeRepo(dir: string): Promise<void> {
  await fs.mkdir(path.join(dir, ".git"), { recursive: true })
}

describe("scanRepos", () => {
  it("发现仓库并尊重 pruneDirs", async () => {
    const root = await makeTempDir()
    const repoA = path.join(root, "repo-a")
    const repoB = path.join(root, "skip", "repo-b")
    await fs.mkdir(repoA, { recursive: true })
    await fs.mkdir(repoB, { recursive: true })
    await makeRepo(repoA)
    await makeRepo(repoB)
    const results = await scanRepos({
      scanRoots: [root],
      pruneDirs: ["skip"],
      maxDepth: 5
    })
    expect(results.map((item) => item.path)).toEqual([repoA])
  })

  it("scanRoot 不存在时记录 warning", async () => {
    const root = await makeTempDir()
    const missing = path.join(root, "missing")
    const warnings: ScanWarning[] = []
    const results = await scanRepos({
      scanRoots: [missing],
      onWarning: (warning) => warnings.push(warning)
    })
    expect(results.length).toBe(0)
    expect(warnings.length).toBe(1)
    expect(warnings[0]?.reason).toBe("not_found")
  })

  it("符号链接默认跳过", async () => {
    const root = await makeTempDir()
    const targetRoot = await makeTempDir()
    const targetRepo = path.join(targetRoot, "repo-link")
    await fs.mkdir(targetRepo, { recursive: true })
    await makeRepo(targetRepo)
    const link = path.join(root, "linked")
    await fs.symlink(targetRepo, link)
    const warnings: ScanWarning[] = []
    const results = await scanRepos({
      scanRoots: [root],
      followSymlinks: false,
      onWarning: (warning) => warnings.push(warning)
    })
    expect(results.length).toBe(0)
    expect(warnings.some((item) => item.reason === "symlink_skipped")).toBe(true)
  })

  it("开启 followSymlinks 后可扫描符号链接目录", async () => {
    const root = await makeTempDir()
    const targetRoot = await makeTempDir()
    const targetRepo = path.join(targetRoot, "repo-link")
    await fs.mkdir(targetRepo, { recursive: true })
    await makeRepo(targetRepo)
    const link = path.join(root, "linked")
    await fs.symlink(targetRepo, link)
    const results = await scanRepos({
      scanRoots: [root],
      followSymlinks: true
    })
    expect(results.length).toBe(1)
    expect(results[0]?.path).toBe(link)
  })
})
