import React, { useMemo, useState } from "react"
import { Box, Text, useApp, useInput, useStdout } from "ink"
import type { Key } from "ink"
import type { RepoInfo } from "../core/types"
import { PreviewPanel } from "./PreviewPanel"
import { ErrorBoundary } from "./ErrorBoundary"

type RepoPickerProps = {
  repos: RepoInfo[]
  onSelect?: (repo: RepoInfo) => void
  onCancel?: () => void
  initialQuery?: string
  status?: {
    mode?: "cache" | "scan" | "rebuild"
    scanDurationMs?: number
    warningCount?: number
    message?: string
  }
}

export function RepoPicker({
  repos,
  onSelect,
  onCancel,
  initialQuery = "",
  status
}: RepoPickerProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [query, setQuery] = useState<string>(initialQuery)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return repos
    }
    return repos.filter((repo) => {
      const haystack = `${repo.ownerRepo} ${repo.path}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, repos])

  const rows = stdout?.rows ?? 24
  const headerHeight = 3
  const footerHeight = 3
  const layoutPadding = 2
  const contentHeight = Math.max(8, rows - headerHeight - footerHeight - layoutPadding)
  const maxVisible = Math.max(3, contentHeight - 4)
  const clampedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, filtered.length - 1))
  const start = Math.min(
    Math.max(0, clampedIndex - Math.floor(maxVisible / 2)),
    Math.max(0, filtered.length - maxVisible)
  )
  const visible = filtered.slice(start, start + maxVisible)
  const selectedRepo = filtered[clampedIndex] ?? null
  const headerWidth = Math.max(0, (stdout?.columns ?? 80) - 4)
  const statusText = truncateText(
    buildStatusText({
      mode: status?.mode,
      scanDurationMs: status?.scanDurationMs,
      warningCount: status?.warningCount,
      message: status?.message,
      filteredCount: filtered.length,
      totalCount: repos.length,
      query
    }),
    headerWidth
  )
  const searchText = truncateText(`搜索: ${query || " "}`, Math.max(0, Math.floor(headerWidth * 0.4) - 2))

  useInput((input: string, key: Key) => {
    if (key.upArrow) {
      setSelectedIndex((value: number) => Math.max(0, value - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex((value: number) => Math.min(filtered.length - 1, value + 1))
      return
    }
    if (key.return) {
      const repo = filtered[clampedIndex]
      if (repo) {
        onSelect?.(repo)
      }
      exit()
      return
    }
    if (key.escape || input === "q") {
      onCancel?.()
      exit()
      return
    }
    if (key.backspace || key.delete) {
      setQuery((value: string) => value.slice(0, -1))
      setSelectedIndex(0)
      return
    }
    if (input) {
      const code = input.charCodeAt(0)
      if (code < 32) {
        return
      }
      setQuery((value: string) => value + input)
      setSelectedIndex(0)
    }
  })

  return (
    <ErrorBoundary>
      <Box flexDirection="column" height="100%">
        <Box borderStyle="round" paddingX={1} width="100%">
          <Text>{statusText}</Text>
        </Box>
        <Box flexGrow={1} gap={1} marginTop={1}>
          <Box width="40%" borderStyle="round" paddingX={1} flexDirection="column">
            <Text color="cyan">{searchText}</Text>
            <Box flexDirection="column" marginTop={1} flexGrow={1}>
              {visible.length === 0 ? (
                <Text dimColor>无匹配仓库</Text>
              ) : (
                visible.map((repo: RepoInfo, index: number) => {
                  const absoluteIndex = start + index
                  const isSelected = absoluteIndex === clampedIndex
                  return (
                    <Text key={repo.path} color={isSelected ? "black" : undefined} backgroundColor={isSelected ? "cyan" : undefined}>
                      {repo.ownerRepo}
                    </Text>
                  )
                })
              )}
            </Box>
          </Box>
          <PreviewPanel repo={selectedRepo} height={contentHeight} />
        </Box>
        <Box borderStyle="round" paddingX={1} marginTop={1}>
          <Text>↑/↓ 选择  Enter 确认  Esc/q 退出  PgUp/PgDn 或 Ctrl+U/Ctrl+D 预览滚动</Text>
        </Box>
      </Box>
    </ErrorBoundary>
  )
}

function buildStatusText(input: {
  mode?: "cache" | "scan" | "rebuild"
  scanDurationMs?: number
  warningCount?: number
  message?: string
  filteredCount: number
  totalCount: number
  query: string
}): string {
  const modeLabel =
    input.mode === "cache"
      ? "使用缓存"
      : input.mode === "rebuild"
        ? "重建缓存"
        : input.mode === "scan"
          ? "扫描中"
          : "就绪"
  const parts = [
    `状态: ${modeLabel}`,
    `仓库: ${input.filteredCount} / ${input.totalCount}`,
    `过滤: ${input.query ? input.query : "-"}`
  ]
  if (typeof input.scanDurationMs === "number") {
    parts.push(`扫描耗时: ${formatDuration(input.scanDurationMs)}`)
  }
  if (input.warningCount && input.warningCount > 0) {
    parts.push(`部分路径被跳过: ${input.warningCount}`)
  }
  if (input.message) {
    parts.push(input.message)
  }
  return parts.join("  |  ")
}

function truncateText(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return ""
  }
  const chars = Array.from(text)
  if (chars.length <= maxWidth) {
    return text
  }
  if (maxWidth === 1) {
    return "…"
  }
  return `${chars.slice(0, maxWidth - 1).join("")}…`
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }
  const seconds = durationMs / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}m${rest.toFixed(0)}s`
}
