import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/cli/help", () => ({
  printHelp: vi.fn(),
  readPackageVersion: vi.fn()
}))

vi.mock("../src/cli/ui", () => ({
  runStatus: vi.fn(),
  runUiCommand: vi.fn(),
  parseUiFlags: vi.fn(),
  runUiServer: vi.fn()
}))

vi.mock("../src/cli/list", () => ({
  runListCommand: vi.fn(),
  runInternalList: vi.fn()
}))

vi.mock("../src/cli/preview", () => ({
  runInternalPreview: vi.fn()
}))

vi.mock("../src/cli/one", () => ({
  runOneCommand: vi.fn()
}))

vi.mock("../src/cli/setup", () => ({
  runSetupWizard: vi.fn()
}))

vi.mock("../src/core/cache", () => ({
  refreshCache: vi.fn()
}))

vi.mock("../src/config/config", () => ({
  ensureConfigFile: vi.fn(),
  getConfigPaths: vi.fn(),
  readConfig: vi.fn()
}))

vi.mock("../src/core/logger", () => ({
  logger: { error: vi.fn() }
}))

const helpMocks = await import("../src/cli/help")
const uiMocks = await import("../src/cli/ui")
const listMocks = await import("../src/cli/list")
const previewMocks = await import("../src/cli/preview")
const oneMocks = await import("../src/cli/one")
const setupMocks = await import("../src/cli/setup")
const cacheMocks = await import("../src/core/cache")
const configMocks = await import("../src/config/config")
const loggerMocks = await import("../src/core/logger")
const { runCli } = await import("../src/cli/main")

describe("cli main", () => {
  const baseConfig = {
    scanRoots: ["/"],
    maxDepth: 7,
    pruneDirs: [],
    cacheTtlMs: 1000,
    followSymlinks: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = 0
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: "/data",
      cacheDir: "/cache",
      configFile: "/cfg/config.json",
      cacheFile: "/cache/cache.json",
      manualTagsFile: "/data/repo_tags.tsv",
      lruFile: "/data/lru.txt"
    })
    vi.mocked(configMocks.readConfig).mockResolvedValue(baseConfig)
    vi.mocked(helpMocks.readPackageVersion).mockResolvedValue("1.2.3")
  })

  it("runCli 处理帮助与版本", async () => {
    process.argv = ["node", "cli"]
    await runCli()
    expect(helpMocks.printHelp).toHaveBeenCalled()
    process.argv = ["node", "cli", "--help"]
    await runCli()
    process.argv = ["node", "cli", "--version"]
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runCli()
    logSpy.mockRestore()
  })

  it("runCli 处理 config/status/ui", async () => {
    vi.mocked(configMocks.ensureConfigFile).mockResolvedValue("/cfg/config.json")
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    process.argv = ["node", "cli", "--config"]
    await runCli()
    process.argv = ["node", "cli", "status"]
    await runCli()
    process.argv = ["node", "cli", "ui"]
    await runCli()
    logSpy.mockRestore()
    expect(uiMocks.runStatus).toHaveBeenCalled()
    expect(uiMocks.runUiCommand).toHaveBeenCalled()
  })

  it("runCli 处理 refresh 与 __ui-serve", async () => {
    vi.mocked(cacheMocks.refreshCache).mockResolvedValue({
      savedAt: Date.now(),
      ttlMs: 1000,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 0,
        scanRoots: [],
        warningCount: 0
      },
      repos: []
    })
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    process.argv = ["node", "cli", "refresh"]
    await runCli()
    vi.mocked(uiMocks.parseUiFlags).mockReturnValue({ noOpen: true, dev: false })
    process.argv = ["node", "cli", "__ui-serve"]
    await runCli()
    logSpy.mockRestore()
    expect(uiMocks.runUiServer).toHaveBeenCalled()
  })

  it("runCli 处理 list/one/__list/__preview", async () => {
    process.argv = ["node", "cli", "list"]
    await runCli()
    process.argv = ["node", "cli", "one"]
    await runCli()
    process.argv = ["node", "cli", "__list"]
    await runCli()
    process.argv = ["node", "cli", "__preview"]
    await runCli()
    expect(listMocks.runListCommand).toHaveBeenCalled()
    expect(oneMocks.runOneCommand).toHaveBeenCalled()
    expect(listMocks.runInternalList).toHaveBeenCalled()
    expect(previewMocks.runInternalPreview).toHaveBeenCalled()
  })

  it("runCli 在 scanRoots 缺失时走向导", async () => {
    vi.mocked(configMocks.readConfig).mockResolvedValue({
      scanRoots: []
    })
    vi.mocked(setupMocks.runSetupWizard).mockResolvedValue(null)
    process.argv = ["node", "cli", "list"]
    await runCli()
    expect(loggerMocks.logger.error).toHaveBeenCalled()
  })

  it("runCli 处理未知命令", async () => {
    process.argv = ["node", "cli", "unknown"]
    await runCli()
    expect(loggerMocks.logger.error).toHaveBeenCalled()
  })
})
