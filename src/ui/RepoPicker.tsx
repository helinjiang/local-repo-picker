import React, { useMemo, useState } from "react"
import { Box, Text, useApp, useInput, useStdout } from "ink"
import type { Key } from "ink"
import type { RepoInfo } from "../core/types.js"

type RepoPickerProps = {
  repos: RepoInfo[]
  onSelect?: (repo: RepoInfo) => void
  onCancel?: () => void
  initialQuery?: string
}

export function RepoPicker({ repos, onSelect, onCancel, initialQuery = "" }: RepoPickerProps) {
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

  const maxVisible = Math.max(5, (stdout?.rows ?? 24) - 10)
  const clampedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, filtered.length - 1))
  const start = Math.min(
    Math.max(0, clampedIndex - Math.floor(maxVisible / 2)),
    Math.max(0, filtered.length - maxVisible)
  )
  const visible = filtered.slice(start, start + maxVisible)

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
      setQuery((value: string) => value + input)
      setSelectedIndex(0)
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" paddingX={1}>
        <Text>Repos: {filtered.length} / {repos.length}</Text>
      </Box>
      <Box flexGrow={1} gap={1} marginTop={1}>
        <Box width="40%" borderStyle="round" paddingX={1} flexDirection="column">
          <Text>
            Search: {query || " "}
          </Text>
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
        <Box width="60%" borderStyle="round" paddingX={1} flexDirection="column" justifyContent="center">
          <Text dimColor>右侧预览区域</Text>
        </Box>
      </Box>
      <Box borderStyle="round" paddingX={1} marginTop={1}>
        <Text>↑/↓ 选择  Enter 确认  Esc/q 退出</Text>
      </Box>
    </Box>
  )
}
