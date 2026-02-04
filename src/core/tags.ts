import { promises as fs } from "node:fs"

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
      const [path, rawTags] = line.split("\t")
      if (!path || !rawTags) {
        continue
      }
      const tags = parseTagList(rawTags)
      if (tags.length > 0) {
        map.set(path.trim(), tags)
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
