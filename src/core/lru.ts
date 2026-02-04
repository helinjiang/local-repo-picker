import { promises as fs } from "node:fs"
import path from "node:path"

export async function readLru(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, "utf8")
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
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
  const next = [repoPath, ...list.filter((item) => item !== repoPath)]
  const trimmed = next.slice(0, limit)
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  await fs.writeFile(filePath, `${trimmed.join("\n")}\n`, "utf8")
  return trimmed
}

export function sortByLru<T extends { path: string }>(
  items: T[],
  lruList: string[]
): T[] {
  if (lruList.length === 0) {
    return items.slice().sort((a, b) => a.path.localeCompare(b.path))
  }
  const order = new Map<string, number>()
  lruList.forEach((item, index) => order.set(item, index))
  return items
    .slice()
    .sort((a, b) => {
      const ai = order.get(a.path)
      const bi = order.get(b.path)
      if (ai === undefined && bi === undefined) {
        return a.path.localeCompare(b.path)
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
