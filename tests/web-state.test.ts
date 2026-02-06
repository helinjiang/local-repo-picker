import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, expect, it, vi } from "vitest"

vi.mock("../src/config/config", () => ({
  getConfigPaths: vi.fn()
}))

const configMocks = await import("../src/config/config")
const { writeUiState, readUiState, clearUiState, isProcessAlive } = await import("../src/web/state")

describe("web state", () => {
  it("write/read/clear ui state", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-state-"))
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: root,
      cacheDir: "/cache",
      configFile: "/cfg/config.json",
      cacheFile: "/cache/cache.json",
      manualTagsFile: "/data/repo_tags.tsv",
      lruFile: "/data/lru.txt"
    })
    await writeUiState({ pid: 1, port: 2, url: "http://x", startedAt: 3 })
    const loaded = await readUiState()
    expect(loaded?.port).toBe(2)
    await clearUiState()
    const empty = await readUiState()
    expect(empty).toBeNull()
    await fs.rm(root, { recursive: true, force: true })
  })

  it("readUiState 处理无效内容", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-state-"))
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: "/cfg",
      dataDir: root,
      cacheDir: "/cache",
      configFile: "/cfg/config.json",
      cacheFile: "/cache/cache.json",
      manualTagsFile: "/data/repo_tags.tsv",
      lruFile: "/data/lru.txt"
    })
    const file = path.join(root, "ui-state.json")
    await fs.writeFile(file, "bad", "utf8")
    const loaded = await readUiState()
    expect(loaded).toBeNull()
    await fs.rm(root, { recursive: true, force: true })
  })

  it("isProcessAlive 检测进程", () => {
    expect(isProcessAlive(process.pid)).toBe(true)
    expect(isProcessAlive(999999)).toBe(false)
  })
})
