import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeRepoKey } from "./path-utils"

export async function readLru(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, "utf8")
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => normalizeRepoKey(line))
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function updateLru(
  filePath: string,
  repoPath: string,
  limit = 300
): Promise<string[]> {
  const list = await readLru(filePath)
  const normalized = normalizeRepoKey(repoPath)
  const next = [normalized, ...list.filter((item) => item !== normalized)]
  const trimmed = next.slice(0, limit)
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  await fs.writeFile(filePath, `${trimmed.join("\n")}\n`, "utf8")
  return trimmed
}

export function sortByLru<T extends { path?: string; fullPath?: string }>(
  items: T[],
  lruList: string[]
): T[] {
  if (lruList.length === 0) {
    return items
      .slice()
      .sort((a, b) => getRepoPath(a).localeCompare(getRepoPath(b)))
  }
  const order = new Map<string, number>()
  lruList.forEach((item, index) => order.set(item, index))
  return items
    .slice()
    .sort((a, b) => {
      const ai = order.get(normalizeRepoKey(getRepoPath(a)))
      const bi = order.get(normalizeRepoKey(getRepoPath(b)))
      if (ai === undefined && bi === undefined) {
        return getRepoPath(a).localeCompare(getRepoPath(b))
      }
      if (ai === undefined) {
        return 1
      }
      if (bi === undefined) {
        return -1
      }
      return ai - bi
    })
}

function getRepoPath(item: { path?: string; fullPath?: string }): string {
  if (item.fullPath) {
    return item.fullPath
  }
  return item.path ?? ""
}
