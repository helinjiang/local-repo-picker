import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, expect, it, vi } from "vitest"

vi.mock("node:readline/promises", () => ({
  default: { createInterface: vi.fn() },
  createInterface: vi.fn()
}))

vi.mock("../src/config/config", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn()
}))

const readlineMocks = await import("node:readline/promises")
const configMocks = await import("../src/config/config")
const { runSetupWizard } = await import("../src/cli/setup")

describe("cli setup", () => {
  it("runSetupWizard 生成配置", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-setup-"))
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    const answers = [
      root,
      "3",
      "node_modules,dist",
      "y"
    ]
    let index = 0
    vi.mocked((readlineMocks as any).default.createInterface).mockReturnValue({
      question: vi.fn(async () => answers[index++] ?? ""),
      close: vi.fn()
    } as any)
    vi.mocked(configMocks.readConfig).mockResolvedValue({
      scanRoots: [root],
      maxDepth: 3,
      pruneDirs: ["node_modules", "dist"],
      followSymlinks: true
    })
    const result = await runSetupWizard(path.join(root, "config.json"))
    expect(configMocks.writeConfig).toHaveBeenCalled()
    expect(result?.scanRoots[0]).toBe(root)
    await fs.rm(root, { recursive: true, force: true })
  })
})
