import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, expect, it, vi } from "vitest"

vi.mock("../src/core/plugins", () => ({
  registerPlugins: vi.fn()
}))

vi.mock("../src/core/cache", () => ({
  refreshCache: vi.fn()
}))

vi.mock("../src/core/origin", () => ({
  readOriginValue: vi.fn(),
  parseOriginToSiteUrl: vi.fn()
}))

vi.mock("execa", () => ({
  execa: vi.fn()
}))

const pluginMocks = await import("../src/core/plugins")
const cacheMocks = await import("../src/core/cache")
const originMocks = await import("../src/core/origin")
const execaMocks = await import("execa")
const { builtInPlugins, registerBuiltInPlugins } = await import("../src/plugins/built-in")

describe("built-in plugins", () => {
  it("builtInPlugins 包含 node tag/preview 插件", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-plugin-"))
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "x" } }))
    const plugin = builtInPlugins[0]
    const tag = await plugin.tags?.[0].apply({
      repoPath: root,
      scanRoot: root,
      ownerRepo: "demo",
      dirty: false,
      baseTags: []
    })
    const preview = await plugin.previews?.[0].render({
      repo: { path: root, ownerRepo: "demo", tags: [], lastScannedAt: 0 },
      preview: {
        path: root,
        origin: "-",
        siteUrl: "-",
        branch: "-",
        status: "clean",
        sync: "-",
        recentCommits: [],
        readme: [],
        readmeStatus: "missing",
        extensions: []
      }
    })
    expect(tag?.[0]).toBe("[node]")
    expect(preview?.lines[0]).toContain("NAME:")
    await fs.rm(root, { recursive: true, force: true })
  })

  it("registerBuiltInPlugins 注册并执行 action", async () => {
    registerBuiltInPlugins({
      scanRoots: ["/"],
      cacheFile: "/cache",
      manualTagsFile: "/tags",
      lruFile: "/lru"
    })
    expect(pluginMocks.registerPlugins).toHaveBeenCalled()
    vi.mocked(originMocks.readOriginValue).mockResolvedValue("https://github.com/a/b.git")
    vi.mocked(originMocks.parseOriginToSiteUrl).mockReturnValue("https://github.com/a/b")
    const action = builtInPlugins[0].actions?.find((item) => item.id === "builtin.open-site")
    await action?.run({ path: "/repo", ownerRepo: "a/b", tags: [], lastScannedAt: 0 })
    expect(execaMocks.execa).toHaveBeenCalled()
    const registered = vi.mocked(pluginMocks.registerPlugins).mock.calls[0]?.[0] ?? []
    const refreshAction = registered[0]?.actions?.find((item) => item.id === "builtin.refresh-cache")
    await refreshAction?.run({ path: "/repo", ownerRepo: "a/b", tags: [], lastScannedAt: 0 })
    expect(cacheMocks.refreshCache).toHaveBeenCalled()
  })
})
