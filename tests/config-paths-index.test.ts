import { describe, expect, it, vi } from "vitest"

vi.mock("env-paths", () => ({
  default: vi.fn(() => ({ config: "/cfg", data: "/data", cache: "/cache" }))
}))

const { getPaths } = await import("../src/config/paths")
const configIndex = await import("../src/config/index")

describe("config paths/index", () => {
  it("getPaths 返回 env-paths 结果", () => {
    const paths = getPaths()
    expect(paths.configDir).toBe("/cfg")
    expect(paths.dataDir).toBe("/data")
  })

  it("config index 导出存在", () => {
    expect(typeof configIndex.getConfigPaths).toBe("function")
    expect(typeof configIndex.readConfig).toBe("function")
    expect(typeof configIndex.writeConfig).toBe("function")
    expect(typeof configIndex.ensureConfigFile).toBe("function")
  })
})
