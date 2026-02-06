import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/config/config", () => ({
  getConfigPaths: vi.fn()
}))

vi.mock("../src/web/state", () => ({
  readUiState: vi.fn(),
  clearUiState: vi.fn(),
  isProcessAlive: vi.fn()
}))

vi.mock("../src/cli/fzf", () => ({
  checkFzfAvailable: vi.fn()
}))

vi.mock("../src/core/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
  isDebugEnabled: vi.fn()
}))

vi.mock("../src/web/server", () => ({
  startWebServer: vi.fn()
}))

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() }))
}))

vi.mock("execa", () => ({
  execa: vi.fn()
}))

vi.mock("node:net", () => ({
  default: { createServer: vi.fn() },
  createServer: vi.fn()
}))

const configMocks = await import("../src/config/config")
const stateMocks = await import("../src/web/state")
const fzfMocks = await import("../src/cli/fzf")
const loggerMocks = await import("../src/core/logger")
const serverMocks = await import("../src/web/server")
const execaMocks = await import("execa")
const netMocks = await import("node:net")
const { runStatus, runUiCommand, parseUiFlags, runUiServer } = await import("../src/cli/ui")

describe("cli ui", () => {
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
  })

  it("parseUiFlags 解析参数", () => {
    expect(parseUiFlags(["ui"])).toEqual({ noOpen: false, dev: false })
    expect(parseUiFlags(["ui", "--no-open", "--dev", "--port", "3000"])).toEqual({
      noOpen: true,
      dev: true,
      port: 3000
    })
    expect(() => parseUiFlags(["ui", "--port", "bad"])).toThrow()
  })

  it("runStatus 在无状态时输出并置失败码", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue(null)
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(false)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runStatus(["status"])
    expect(process.exitCode).toBe(1)
    logSpy.mockRestore()
  })

  it("runStatus 支持 json 输出", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue(null)
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(true)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runStatus(["status", "--json"])
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it("runStatus 在状态异常时清理", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 1,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(false)
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(true)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runStatus(["status"])
    expect(stateMocks.clearUiState).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it("runStatus 在崩溃时输出 json", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 1,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(false)
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(false)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runStatus(["status", "--json"])
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it("runStatus 在运行中输出 url", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 1,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(true)
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(true)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runStatus(["status"])
    logSpy.mockRestore()
  })

  it("runUiCommand stop 与 restart", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue(null)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runUiCommand(["ui", "stop"])
    expect(process.exitCode).toBe(1)
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 1,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValue(true)
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)
    vi.mocked(execaMocks.execa as any).mockResolvedValue({ exitCode: 0 })
    await runUiCommand(["ui", "restart"])
    killSpy.mockRestore()
    logSpy.mockRestore()
  })

  it("runUiCommand stop 处理终止失败", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 999,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(true)
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("bad")
    })
    await runUiCommand(["ui", "stop"])
    expect(loggerMocks.logger.error).toHaveBeenCalled()
    killSpy.mockRestore()
  })

  it("runUiCommand 处理参数错误", async () => {
    await runUiCommand(["ui", "--port", "bad"])
    expect(loggerMocks.logger.error).toHaveBeenCalled()
  })

  it("runUiCommand 启动并打开浏览器", async () => {
    vi.mocked(stateMocks.readUiState)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        pid: 1,
        port: 1,
        url: "http://x",
        startedAt: 1
      })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(true)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runUiCommand(["ui", "--port", "17333"])
    expect(execaMocks.execa).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it("runUiCommand 在已有状态时直接输出", async () => {
    vi.mocked(stateMocks.readUiState).mockResolvedValue({
      pid: 1,
      port: 1,
      url: "http://x",
      startedAt: 1
    })
    vi.mocked(stateMocks.isProcessAlive).mockReturnValue(true)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    await runUiCommand(["ui", "--port", "17333"])
    logSpy.mockRestore()
  })

  it("runUiServer 返回启动信息", async () => {
    vi.mocked(serverMocks.startWebServer).mockResolvedValue({
      pid: 1,
      port: 100,
      url: "http://x",
      startedAt: 1,
      apiPort: 100,
      apiUrl: "http://x"
    })
    const result = await runUiServer(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      { noOpen: true, dev: false }
    )
    expect(result.url).toBe("http://x")
  })

  it("runUiServer dev 模式启动", async () => {
    const createServer = vi.mocked((netMocks as any).default.createServer)
    let count = 0
    createServer.mockImplementation(() => {
      const handlers: Record<string, Function> = {}
      return {
        once: (event: string, cb: Function) => {
          handlers[event] = cb
        },
        listen: () => {
          count += 1
          if (count === 1) {
            handlers.error?.(new Error("inuse"))
          } else {
            handlers.listening?.()
          }
        },
        close: (cb: Function) => cb()
      }
    })
    vi.mocked(serverMocks.startWebServer).mockResolvedValue({
      pid: 1,
      port: 100,
      url: "http://x",
      startedAt: 1,
      apiPort: 100,
      apiUrl: "http://x"
    })
    vi.mocked(execaMocks.execa as any).mockResolvedValue({ exitCode: 0 })
    const result = await runUiServer(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      { noOpen: true, dev: true, port: 5173 }
    )
    expect(result.url).toContain("127.0.0.1")
  })
})
