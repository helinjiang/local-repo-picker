import { useEffect, useRef, useState } from "react"
import type { RepoInfo, RepoPreview } from "../core/types"
import { buildRepoPreview, type RepoPreviewResult } from "../core/preview"

const cache = new Map<string, RepoPreviewResult>()
const inFlight = new Map<string, Promise<RepoPreviewResult>>()

export type { RepoPreview } from "../core/types"

export type PreviewState = {
  loading: boolean
  data: RepoPreview | null
  error?: string
}

export function useRepoPreview(repo: RepoInfo | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ loading: false, data: null })
  const requestIdRef = useRef(0)
  const currentPathRef = useRef<string | null>(null)

  useEffect(() => {
    const repoPath = repo?.path
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    currentPathRef.current = repoPath ?? null
    if (!repoPath) {
      setState({ loading: false, data: null })
      return
    }
    const cached = cache.get(repoPath)
    if (cached) {
      setState({ loading: false, data: cached.data, error: cached.error })
      return
    }
    setState({ loading: true, data: null })
    const timer = setTimeout(() => {
      const pending = inFlight.get(repoPath) ?? buildRepoPreview(repo)
      inFlight.set(repoPath, pending)
      pending.then((result) => {
        cache.set(repoPath, result)
        inFlight.delete(repoPath)
        if (requestId === requestIdRef.current && currentPathRef.current === repoPath) {
          setState({ loading: false, data: result.data, error: result.error })
        }
      })
    }, 120)
    return () => {
      clearTimeout(timer)
    }
  }, [repo?.path])

  return state
}
