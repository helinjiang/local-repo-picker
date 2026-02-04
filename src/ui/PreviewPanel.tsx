import React from "react"
import { Box, Text, useInput, useStdout } from "ink"
import { useMemo, useState } from "react"
import type { RepoInfo } from "../core/types.js"
import { useRepoPreview } from "./useRepoPreview.js"

type PreviewPanelProps = {
  repo: RepoInfo | null
}

export function PreviewPanel({ repo }: PreviewPanelProps) {
  const { stdout } = useStdout()
  const maxHeight = Math.max(10, Math.floor((stdout?.rows ?? 24) * 0.7))
  const { loading, data } = useRepoPreview(repo)
  const [scrollOffset, setScrollOffset] = useState(0)

  const content = useMemo(() => {
    if (!repo) {
      return ["右侧预览区域"]
    }
    if (loading && !data) {
      return ["Loading..."]
    }
    const lines: string[] = []
    lines.push(`PATH: ${data?.path ?? repo.path}`)
    lines.push(`ORIGIN: ${data?.origin ?? "-"}`)
    lines.push(`BRANCH: ${data?.branch ?? "-"}`)
    lines.push(`STATUS: ${data?.status ?? "-"}`)
    lines.push(`SYNC: ${data?.sync ?? "-"}`)
    lines.push("")
    lines.push("RECENT COMMITS:")
    if (data?.recentCommits?.length) {
      lines.push(...data.recentCommits)
    } else {
      lines.push("无提交信息")
    }
    lines.push("")
    lines.push("README:")
    if (data?.readme?.length) {
      lines.push(...data.readme.map((line) => (line === "" ? " " : line)))
    } else {
      lines.push("无 README")
    }
    return lines
  }, [repo, loading, data])

  useInput((_input, key) => {
    if (!repo) {
      return
    }
    if (key.pageDown || (key.ctrl && _input === "d")) {
      setScrollOffset((value) => Math.min(value + Math.max(1, maxHeight - 6), Math.max(0, content.length - maxHeight)))
      return
    }
    if (key.pageUp || (key.ctrl && _input === "u")) {
      setScrollOffset((value) => Math.max(0, value - Math.max(1, maxHeight - 6)))
    }
  })

  const start = Math.min(scrollOffset, Math.max(0, content.length - maxHeight))
  const visible = content.slice(start, start + maxHeight)

  if (!repo) {
    return (
      <Box width="60%" height={maxHeight} borderStyle="round" paddingX={1} flexDirection="column" justifyContent="center">
        <Text dimColor>{visible[0]}</Text>
      </Box>
    )
  }

  if (loading && !data) {
    return (
      <Box width="60%" height={maxHeight} borderStyle="round" paddingX={1} flexDirection="column" justifyContent="center">
        <Text>{visible[0]}</Text>
      </Box>
    )
  }

  return (
    <Box width="60%" height={maxHeight} borderStyle="round" paddingX={1} flexDirection="column">
      {visible.map((line, index) => (
        <Text key={`${repo.path}-preview-${start + index}`}>{line}</Text>
      ))}
    </Box>
  )
}
