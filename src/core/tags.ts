import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeRepoKey } from "./path-utils"

export type ManualTagEdits = {
  add: string[]
  remove: string[]
}

export type ManualTagEditsMap = Map<string, ManualTagEdits>

export async function readManualTagEdits(
  filePath: string
): Promise<ManualTagEditsMap> {
  const map: ManualTagEditsMap = new Map()
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
      const edits = parseManualTagEdits(rawTags)
      if (edits.add.length > 0 || edits.remove.length > 0) {
        const normalized = normalizeRepoKey(rawPath)
        if (normalized) {
          map.set(normalized, edits)
        }
      }
    }
  } catch {
    return map
  }
  return map
}

export async function readManualTags(
  filePath: string
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
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
      const normalized = normalizeRepoKey(rawPath)
      if (!normalized) {
        continue
      }
      const edits = parseManualTagEdits(rawTags)
      if (edits.add.length > 0) {
        map.set(normalized, edits.add)
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

export async function setManualTags(
  filePath: string,
  repoPath: string,
  tags: string[]
): Promise<void> {
  const normalizedPath = normalizeRepoKey(repoPath)
  if (!normalizedPath) {
    return
  }
  const existing = await readManualTagEditsRaw(filePath)
  const current = existing.get(normalizedPath)?.edits
  const add = uniqueTags(tags)
  const remove = (current?.remove ?? []).filter((tag) => !add.includes(tag))
  if (add.length === 0 && remove.length === 0) {
    existing.delete(normalizedPath)
  } else {
    existing.set(normalizedPath, { path: repoPath, edits: { add, remove } })
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  const lines = Array.from(existing.values())
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => `${item.path}\t${serializeManualTagEdits(item.edits)}`)
  const content = lines.length > 0 ? `${lines.join("\n")}\n` : ""
  await fs.writeFile(filePath, content, "utf8")
}

export async function updateManualTagEdits(
  filePath: string,
  repoPath: string,
  updates: { add?: string[]; remove?: string[] }
): Promise<void> {
  const normalizedPath = normalizeRepoKey(repoPath)
  if (!normalizedPath) {
    return
  }
  const existing = await readManualTagEditsRaw(filePath)
  const current = existing.get(normalizedPath)?.edits ?? { add: [], remove: [] }
  const addSet = new Set(current.add)
  const removeSet = new Set(current.remove)
  for (const tag of updates.add ?? []) {
    addSet.add(tag)
    removeSet.delete(tag)
  }
  for (const tag of updates.remove ?? []) {
    removeSet.add(tag)
    addSet.delete(tag)
  }
  const nextAdd = Array.from(addSet)
  const nextRemove = Array.from(removeSet).filter((tag) => !addSet.has(tag))
  if (nextAdd.length === 0 && nextRemove.length === 0) {
    existing.delete(normalizedPath)
  } else {
    existing.set(normalizedPath, { path: repoPath, edits: { add: nextAdd, remove: nextRemove } })
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  const lines = Array.from(existing.values())
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => `${item.path}\t${serializeManualTagEdits(item.edits)}`)
  const content = lines.length > 0 ? `${lines.join("\n")}\n` : ""
  await fs.writeFile(filePath, content, "utf8")
}

function parseManualTagEdits(raw: string): ManualTagEdits {
  const add: string[] = []
  const remove: string[] = []
  const regex = /([!-])?\[[^\]]+\]/g
  let matched = false
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    matched = true
    const token = match[0]
    const prefix = match[1]
    const tag = prefix ? token.slice(1) : token
    if (prefix) {
      remove.push(tag)
    } else {
      add.push(tag)
    }
  }
  if (!matched) {
    add.push(...parseTagList(raw))
  }
  const uniqueAdd = uniqueTags(add)
  const uniqueRemove = uniqueTags(remove).filter((tag) => !uniqueAdd.includes(tag))
  return { add: uniqueAdd, remove: uniqueRemove }
}

function serializeManualTagEdits(edits: ManualTagEdits): string {
  const add = uniqueTags(edits.add)
  const remove = uniqueTags(edits.remove).filter((tag) => !add.includes(tag))
  return [...add, ...remove.map((tag) => `!${tag}`)].join("")
}

async function readManualTagEditsRaw(
  filePath: string
): Promise<Map<string, { path: string; edits: ManualTagEdits }>> {
  const map = new Map<string, { path: string; edits: ManualTagEdits }>()
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
      const edits = parseManualTagEdits(rawTags)
      if (edits.add.length === 0 && edits.remove.length === 0) {
        continue
      }
      map.set(key, { path: rawPath, edits })
    }
  } catch {
    return map
  }
  return map
}
