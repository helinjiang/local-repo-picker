import { describe, expect, it } from "vitest"
import { buildTags, getRemoteTag, parseTagList } from "../src/core/tags"

describe("tags", () => {
  it("解析 tag 列表", () => {
    expect(parseTagList("[a][b]")).toEqual(["[a]", "[b]"])
    expect(parseTagList("foo bar")).toEqual(["[foo]", "[bar]"])
  })

  it("生成 remote tag", () => {
    expect(getRemoteTag("github.com")).toBe("[github]")
    expect(getRemoteTag("gitee.com")).toBe("[gitee]")
    expect(getRemoteTag("custom.local")).toBe("[internal:custom.local]")
    expect(getRemoteTag()).toBe("[noremote]")
  })

  it("构建最终 tags", () => {
    expect(
      buildTags({
        remoteTag: "[github]",
        autoTag: "[team]",
        manualTags: ["[manual]"],
        dirty: true
      })
    ).toEqual(["[github]", "[manual]", "[dirty]"])
    expect(
      buildTags({
        remoteTag: "[github]",
        autoTag: "[team]",
        dirty: false
      })
    ).toEqual(["[github]", "[team]"])
  })
})
