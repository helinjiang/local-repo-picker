import { describe, expect, it, vi } from "vitest"

vi.mock("../src/core/cache", () => ({
  loadCache: vi.fn()
}))

const cacheMocks = await import("../src/core/cache")
const { resolveRepoInfo } = await import("../src/cli/repo")

describe("cli repo", () => {
  it("resolveRepoInfo 命中缓存", async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue({
      savedAt: Date.now(),
      ttlMs: 1000,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 1,
        scanRoots: ["/"]
      },
      repos: [{ path: "/a", ownerRepo: "a", tags: [], lastScannedAt: 0 }]
    })
    const repo = await resolveRepoInfo(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      "/a"
    )
    expect(repo.ownerRepo).toBe("a")
  })

  it("resolveRepoInfo 未命中缓存时返回默认结构", async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null)
    const repo = await resolveRepoInfo(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      "/b"
    )
    expect(repo.path).toBe("/b")
    expect(repo.tags).toEqual([])
  })
})
