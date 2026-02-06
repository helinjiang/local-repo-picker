import { describe, expect, it, vi } from "vitest"

vi.mock("execa", () => ({
  execa: vi.fn()
}))

vi.mock("../src/core/plugins", () => ({
  getRegisteredActions: vi.fn()
}))

vi.mock("../src/plugins/built-in", () => ({
  registerBuiltInPlugins: vi.fn()
}))

const execaMocks = await import("execa")
const pluginsMocks = await import("../src/core/plugins")
const { runFzfPicker, runFzfActionPicker, checkFzfAvailable } = await import("../src/cli/fzf")

describe("cli fzf", () => {
  it("checkFzfAvailable 在成功时返回 true", async () => {
    ;(execaMocks.execa as any).mockResolvedValue({ exitCode: 0 })
    expect(await checkFzfAvailable()).toBe(true)
  })

  it("runFzfPicker 解析选中路径", async () => {
    ;(execaMocks.execa as any).mockImplementation(async (command: any, args: any) => {
      if (command === "repo") {
        return { exitCode: 0, stdout: "a\t/path\t[tag]" }
      }
      if (command === "fzf") {
        return { exitCode: 0, stdout: "a\t/selected\t[tag]" }
      }
      return { exitCode: 1, stdout: "" }
    })
    const selected = await runFzfPicker(
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" },
      { "ctrl-a": "all" }
    )
    expect(selected).toBe("/selected")
  })

  it("runFzfActionPicker 根据选择返回 action", async () => {
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([
      { id: "a", label: "Action A", run: async () => {}, scopes: ["cli"] },
      { id: "b", label: "Action B", run: async () => {}, scopes: ["web"] }
    ])
    ;(execaMocks.execa as any).mockResolvedValue({
      exitCode: 0,
      stdout: "Action A\ta"
    })
    const action = await runFzfActionPicker(
      { path: "/repo", ownerRepo: "x", tags: [], lastScannedAt: 0 },
      { scanRoots: ["/"], cacheFile: "", manualTagsFile: "", lruFile: "" }
    )
    expect(action?.id).toBe("a")
  })
})
