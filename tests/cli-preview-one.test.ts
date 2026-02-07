import path from "node:path"
import os from "node:os"
import { promises as fs } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/core/preview", () => ({
  buildRepoPreview: vi.fn()
}))

vi.mock("../src/cli/repo", () => ({
  resolveRepoInfo: vi.fn()
}))

vi.mock("../src/core/logger", () => ({
  logger: { error: vi.fn() }
}))

vi.mock("../src/cli/fzf", () => ({
  checkFzfAvailable: vi.fn(),
  runFzfActionPicker: vi.fn()
}))

vi.mock("../src/core/git", () => ({
  runGit: vi.fn()
}))

const previewMocks = await import("../src/core/preview")
const repoMocks = await import("../src/cli/repo")
const loggerMocks = await import("../src/core/logger")
const fzfMocks = await import("../src/cli/fzf")
const gitMocks = await import("../src/core/git")
const { runInternalPreview } = await import("../src/cli/preview")
const { runOneCommand } = await import("../src/cli/one")

describe("cli preview/one", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = 0
  })

  it("runInternalPreview 校验路径参数", async () => {
    await runInternalPreview(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      ["__preview"]
    )
    expect(loggerMocks.logger.error).toHaveBeenCalled()
    await runInternalPreview(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      ["__preview", "--path", "relative"]
    )
    expect(loggerMocks.logger.error).toHaveBeenCalled()
  })

  it("runInternalPreview 输出预览内容", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-preview-cli-"))
    vi.mocked(repoMocks.resolveRepoInfo).mockResolvedValue({
      path: root,
      ownerRepo: "a/b",
      tags: [],
      lastScannedAt: 0
    })
    vi.mocked(previewMocks.buildRepoPreview).mockResolvedValue({
      data: {
        path: root,
        repoPath: "a/b",
        repoKey: "local:a/b",
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
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runInternalPreview(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      ["__preview", "--path", root]
    )
    logSpy.mockRestore()
    await fs.rm(root, { recursive: true, force: true })
  })

  it("runOneCommand 覆盖失败与成功分支", async () => {
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true })
    await runOneCommand({ scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" })
    expect(loggerMocks.logger.error).toHaveBeenCalled()

    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(false)
    await runOneCommand({ scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" })
    expect(loggerMocks.logger.error).toHaveBeenCalled()

    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(true)
    vi.mocked(gitMocks.runGit).mockResolvedValue({ ok: false, kind: "not_repo", message: "x" })
    await runOneCommand({ scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" })
    expect(loggerMocks.logger.error).toHaveBeenCalled()

    vi.mocked(gitMocks.runGit).mockResolvedValue({ ok: true, stdout: "/repo" })
    vi.mocked(repoMocks.resolveRepoInfo).mockResolvedValue({
      path: "/repo",
      ownerRepo: "a/b",
      tags: [],
      lastScannedAt: 0
    })
    const actionRun = vi.fn(async () => {})
    vi.mocked(fzfMocks.runFzfActionPicker).mockResolvedValue({ id: "x", label: "x", run: actionRun })
    await runOneCommand({ scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" })
    expect(actionRun).toHaveBeenCalled()
  })
})
