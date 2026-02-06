import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/core/scan", () => ({
  scanRepos: vi.fn()
}))

vi.mock("../src/core/tags", () => ({
  readManualTagEdits: vi.fn(),
  buildTags: vi.fn(),
  getRemoteTag: vi.fn(),
  uniqueTags: vi.fn()
}))

vi.mock("../src/core/git", () => ({
  readOriginUrl: vi.fn(),
  parseOriginInfo: vi.fn(),
  isDirty: vi.fn()
}))

vi.mock("../src/core/lru", () => ({
  readLru: vi.fn(),
  sortByLru: vi.fn()
}))

vi.mock("../src/core/plugins", () => ({
  resolveTagExtensions: vi.fn()
}))

vi.mock("../src/config/config", () => ({
  getConfigPaths: vi.fn()
}))

vi.mock("../src/core/logger", () => ({
  logger: { debug: vi.fn() }
}))

const scanMocks = await import("../src/core/scan")
const tagMocks = await import("../src/core/tags")
const gitMocks = await import("../src/core/git")
const lruMocks = await import("../src/core/lru")
const pluginMocks = await import("../src/core/plugins")
const configMocks = await import("../src/config/config")
const { buildCache, loadCache, refreshCache } = await import("../src/core/cache")

describe("core cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("buildCache 构建并写入缓存", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-cache-"))
    const cacheFile = path.join(root, "cache.json")
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: "/data",
      cacheDir: root,
      configFile: "/cfg/config.json",
      cacheFile,
      manualTagsFile: path.join(root, "repo_tags.tsv"),
      lruFile: path.join(root, "lru.txt")
    })
    vi.mocked(scanMocks.scanRepos).mockResolvedValue([
      { path: path.join(root, "repo-a"), scanRoot: root, autoTag: "[team]" }
    ])
    vi.mocked(tagMocks.readManualTagEdits).mockResolvedValue(
      new Map([[path.join(root, "repo-a"), { add: ["[manual]"], remove: [] }]])
    )
    vi.mocked(gitMocks.readOriginUrl).mockResolvedValue("https://github.com/a/b.git")
    vi.mocked(gitMocks.parseOriginInfo).mockReturnValue({ host: "github.com", ownerRepo: "a/b" })
    vi.mocked(gitMocks.isDirty).mockResolvedValue(false)
    vi.mocked(tagMocks.getRemoteTag).mockReturnValue("[github]")
    vi.mocked(tagMocks.buildTags).mockReturnValue(["[github]", "[manual]"])
    vi.mocked(tagMocks.uniqueTags).mockImplementation((tags: string[]) => tags)
    vi.mocked(pluginMocks.resolveTagExtensions).mockResolvedValue(["[extra]"])
    vi.mocked(lruMocks.readLru).mockResolvedValue([])
    vi.mocked(lruMocks.sortByLru).mockImplementation((repos: any) => repos)
    const cache = await buildCache({
      scanRoots: [root],
      cacheFile,
      manualTagsFile: path.join(root, "repo_tags.tsv"),
      lruFile: path.join(root, "lru.txt")
    })
    expect(cache.repos.length).toBe(1)
    const content = await fs.readFile(cacheFile, "utf8")
    expect(content).toContain("repo-a")
    await fs.rm(root, { recursive: true, force: true })
  })

  it("loadCache 处理损坏与过期缓存", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-cache-"))
    const cacheFile = path.join(root, "cache.json")
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: "/data",
      cacheDir: root,
      configFile: "/cfg/config.json",
      cacheFile,
      manualTagsFile: path.join(root, "repo_tags.tsv"),
      lruFile: path.join(root, "lru.txt")
    })
    await fs.writeFile(cacheFile, "{", "utf8")
    const corrupted = await loadCache({ scanRoots: [root], cacheFile })
    expect(corrupted).toBeNull()
    await fs.writeFile(
      cacheFile,
      JSON.stringify({ savedAt: 0, ttlMs: 1, repos: [] }),
      "utf8"
    )
    const expired = await loadCache({ scanRoots: [root], cacheFile, cacheTtlMs: 1 })
    expect(expired).toBeNull()
    await fs.rm(root, { recursive: true, force: true })
  })

  it("loadCache 处理不存在路径并写回", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-cache-"))
    const cacheFile = path.join(root, "cache.json")
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: "/data",
      cacheDir: root,
      configFile: "/cfg/config.json",
      cacheFile,
      manualTagsFile: path.join(root, "repo_tags.tsv"),
      lruFile: path.join(root, "lru.txt")
    })
    const data = {
      savedAt: Date.now(),
      ttlMs: 1000,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 1,
        scanRoots: [root]
      },
      repos: [{ path: path.join(root, "missing"), ownerRepo: "x", tags: [], lastScannedAt: 0 }]
    }
    await fs.writeFile(cacheFile, JSON.stringify(data), "utf8")
    vi.mocked(lruMocks.readLru).mockResolvedValue([])
    vi.mocked(lruMocks.sortByLru).mockImplementation((repos: any) => repos)
    const loaded = await loadCache({ scanRoots: [root], cacheFile })
    expect(loaded?.metadata.prunedRepoCount).toBe(1)
    await fs.rm(root, { recursive: true, force: true })
  })

  it("refreshCache 调用 buildCache", async () => {
    vi.mocked(scanMocks.scanRepos).mockResolvedValue([])
    vi.mocked(tagMocks.readManualTagEdits).mockResolvedValue(new Map())
    vi.mocked(gitMocks.readOriginUrl).mockResolvedValue(null)
    vi.mocked(gitMocks.parseOriginInfo).mockReturnValue({ ownerRepo: "" })
    vi.mocked(gitMocks.isDirty).mockResolvedValue(false)
    vi.mocked(tagMocks.getRemoteTag).mockReturnValue("[noremote]")
    vi.mocked(tagMocks.buildTags).mockReturnValue(["[noremote]"])
    vi.mocked(tagMocks.uniqueTags).mockImplementation((tags: string[]) => tags)
    vi.mocked(pluginMocks.resolveTagExtensions).mockResolvedValue([])
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-cache-"))
    const cacheFile = path.join(root, "cache.json")
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: "/data",
      cacheDir: root,
      configFile: "/cfg/config.json",
      cacheFile,
      manualTagsFile: path.join(root, "repo_tags.tsv"),
      lruFile: path.join(root, "lru.txt")
    })
    const cache = await refreshCache({ scanRoots: [root], cacheFile })
    expect(cache.repos.length).toBe(0)
    await fs.rm(root, { recursive: true, force: true })
  })
})
