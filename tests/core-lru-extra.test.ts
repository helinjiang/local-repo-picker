import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, expect, it } from "vitest"
import { readLru, updateLru, sortByLru } from "../src/core/lru"

describe("core lru extra", () => {
  it("readLru 在文件不存在时返回空", async () => {
    const list = await readLru("/non-exists")
    expect(list).toEqual([])
  })

  it("updateLru 追加并去重", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lrp-lru-"))
    const file = path.join(root, "lru.txt")
    await fs.writeFile(file, "/a\n/b\n", "utf8")
    const list = await updateLru(file, "/b", 2)
    expect(list[0]).toBe("/b")
    const list2 = await updateLru(file, "/c", 2)
    expect(list2.length).toBe(2)
    await fs.rm(root, { recursive: true, force: true })
  })

  it("sortByLru 支持无 lru 与部分命中", () => {
    const items = [{ path: "/b" }, { path: "/a" }]
    const sortedDefault = sortByLru(items, [])
    expect(sortedDefault[0].path).toBe("/a")
    const sorted = sortByLru(items, ["/b"])
    expect(sorted[0].path).toBe("/b")
  })
})
