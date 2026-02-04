import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, expect, it } from "vitest"
import { buildTags, getRemoteTag, parseTagList, readManualTags } from "../src/core/tags"
import { normalizeRepoKey } from "../src/core/path-utils"

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

  it("读取手动 tags 时进行路径归一化", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-tags-"))
    const repoPath = path.join(root, "repo-a")
    await fs.mkdir(repoPath, { recursive: true })
    const manualTagsFile = path.join(root, "repo_tags.tsv")
    const pathWithSegments = path.join(repoPath, "..", "repo-a")
    await fs.writeFile(manualTagsFile, `${pathWithSegments}\t[manual]\n`, "utf8")
    const map = await readManualTags(manualTagsFile)
    expect(map.get(normalizeRepoKey(repoPath))).toEqual(["[manual]"])
    await fs.rm(root, { recursive: true, force: true })
  })
})
