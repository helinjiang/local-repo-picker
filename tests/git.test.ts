import { describe, expect, it } from "vitest"
import { parseOriginInfo } from "../src/core/git"

describe("git parseOriginInfo", () => {
  it("解析 https origin", () => {
    const result = parseOriginInfo("https://github.com/org/repo.git")
    expect(result.host).toBe("github.com")
    expect(result.ownerRepo).toBe("org/repo")
  })

  it("解析 ssh origin", () => {
    const result = parseOriginInfo("git@github.com:org/repo.git")
    expect(result.host).toBe("github.com")
    expect(result.ownerRepo).toBe("org/repo")
  })

  it("处理异常 origin", () => {
    const result = parseOriginInfo("not-a-url")
    expect(result.ownerRepo).toBe("")
  })
})
