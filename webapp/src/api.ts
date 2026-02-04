import type { RepoItem, RepoPreviewResult } from "./types"

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api"

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${input}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }
  return (await response.json()) as T
}

export async function fetchRepos(params: { q?: string; tag?: string }): Promise<RepoItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.tag) search.set("tag", params.tag)
  const suffix = search.toString() ? `?${search.toString()}` : ""
  return request<RepoItem[]>(`/repos${suffix}`)
}

export async function fetchPreview(path: string): Promise<RepoPreviewResult> {
  const search = new URLSearchParams({ path })
  return request<RepoPreviewResult>(`/preview?${search.toString()}`)
}

export async function runAction(actionId: string, path: string): Promise<void> {
  await request("/action", {
    method: "POST",
    body: JSON.stringify({ actionId, path })
  })
}

export async function refreshCache(): Promise<{ ok: boolean; repoCount: number }> {
  return request("/cache/refresh", { method: "POST" })
}

export async function upsertTags(path: string, tags: string): Promise<void> {
  await request("/tags", {
    method: "POST",
    body: JSON.stringify({ path, tags, refresh: true })
  })
}
