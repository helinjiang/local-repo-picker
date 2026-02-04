import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeRepoKey } from "./path-utils"

export type ManualTagsMap = Map<string, string[]>

export async function readManualTags(
  filePath: string
): Promise<ManualTagsMap> {
  const map: ManualTagsMap = new Map()
  try {
    const content = await fs.readFile(filePath, "utf8")
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      const [rawPath, rawTags] = line.split("\t")
      if (!rawPath || !rawTags) {
        continue
      }
      const tags = parseTagList(rawTags)
      if (tags.length > 0) {
        const normalized = normalizeRepoKey(rawPath)
        if (normalized) {
          map.set(normalized, tags)
        }
      }
    }
  } catch {
    return map
  }
  return map
}

export function parseTagList(raw: string): string[] {
  const matches = raw.match(/\[[^\]]+\]/g)
  if (matches && matches.length > 0) {
    return matches.map((tag) => tag.trim())
  }
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  return tokens.map((token) =>
    token.startsWith("[") && token.endsWith("]") ? token : `[${token}]`
  )
}

export function getRemoteTag(host?: string): string {
  if (!host) {
    return "[noremote]"
  }
  if (host === "github.com") {
    return "[github]"
  }
  if (host === "gitee.com") {
    return "[gitee]"
  }
  return `[internal:${host}]`
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    if (seen.has(tag)) {
      continue
    }
    seen.add(tag)
    result.push(tag)
  }
  return result
}

export function buildTags(options: {
  remoteTag: string
  autoTag?: string
  manualTags?: string[]
  dirty: boolean
}): string[] {
  const base =
    options.manualTags && options.manualTags.length > 0
      ? [options.remoteTag, ...options.manualTags]
      : options.autoTag
        ? [options.remoteTag, options.autoTag]
        : [options.remoteTag]
  const tags = options.dirty ? [...base, "[dirty]"] : base
  return uniqueTags(tags)
}

export async function upsertManualTags(
  filePath: string,
  repoPath: string,
  tags: string[]
): Promise<void> {
  const normalizedPath = normalizeRepoKey(repoPath)
  if (!normalizedPath) {
    return
  }
  const existing = await readManualTagsRaw(filePath)
  existing.set(normalizedPath, { path: repoPath, tags })
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  const lines = Array.from(existing.values())
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => `${item.path}\t${item.tags.join("")}`)
  const content = lines.length > 0 ? `${lines.join("\n")}\n` : ""
  await fs.writeFile(filePath, content, "utf8")
}

async function readManualTagsRaw(
  filePath: string
): Promise<Map<string, { path: string; tags: string[] }>> {
  const map = new Map<string, { path: string; tags: string[] }>()
  try {
    const content = await fs.readFile(filePath, "utf8")
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      const [rawPath, rawTags] = line.split("\t")
      if (!rawPath || !rawTags) {
        continue
      }
      const key = normalizeRepoKey(rawPath)
      if (!key) {
        continue
      }
      const parsed = parseTagList(rawTags)
      if (parsed.length === 0) {
        continue
      }
      map.set(key, { path: rawPath, tags: parsed })
    }
  } catch {
    return map
  }
  return map
}
