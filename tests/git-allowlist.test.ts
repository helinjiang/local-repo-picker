import { describe, expect, it } from "vitest"
import { runGit } from "../src/core/git"

describe("git allowlist", () => {
  it("拒绝不在白名单内的子命令", async () => {
    const result = await runGit(["clone", "https://example.com/repo.git"])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe("not_allowed")
    }
  })

  it("拒绝非允许的 flag 形式", async () => {
    const result = await runGit(["--help"])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe("not_allowed")
    }
  })
})
