import { useEffect, useMemo, useState } from "react"
import { App as AntApp, Button, Input, Select, Space, message } from "antd"
import type { RepoItem, RepoPreviewResult } from "./types"
import { fetchPreview, fetchRepos, refreshCache, runAction, upsertTags } from "./api"
import RepoList from "./components/RepoList"
import PreviewPanel from "./components/PreviewPanel"
import ActionsBar from "./components/ActionsBar"
import TagModal from "./components/TagModal"

function useDebounce(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export default function App() {
  const [repos, setRepos] = useState<RepoItem[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<RepoPreviewResult | null>(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(200)
  const [total, setTotal] = useState(0)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const [messageApi, contextHolder] = message.useMessage()

  const tagOptions = useMemo(() => {
    const tagSet = new Set<string>()
    repos.forEach((repo) => repo.tags.forEach((item) => tagSet.add(item)))
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  }, [repos])

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.path === selectedPath) ?? null,
    [repos, selectedPath]
  )

  useEffect(() => {
    let cancelled = false
    async function loadRepos() {
      setLoadingRepos(true)
      try {
        const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
        if (cancelled) return
        if (data.items.length === 0 && page > 1) {
          setPage(1)
          return
        }
        setRepos(data.items)
        setTotal(data.total)
        setPage(data.page)
        setPageSize(data.pageSize)
        if (!data.items.find((repo) => repo.path === selectedPath)) {
          setSelectedPath(data.items[0]?.path ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取仓库列表失败：${(error as Error).message}`)
        }
      } finally {
        if (!cancelled) setLoadingRepos(false)
      }
    }
    void loadRepos()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, tag, page, pageSize, messageApi])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, tag])

  useEffect(() => {
    let cancelled = false
    async function loadPreview() {
      if (!selectedPath) {
        setPreview(null)
        return
      }
      setLoadingPreview(true)
      try {
        const data = await fetchPreview(selectedPath)
        if (!cancelled) setPreview(data)
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`预览加载失败：${(error as Error).message}`)
        }
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [selectedPath, messageApi])

  const handleRefresh = async () => {
    try {
      await refreshCache()
      messageApi.success("缓存已刷新")
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
    } catch (error) {
      messageApi.error(`刷新缓存失败：${(error as Error).message}`)
    }
  }

  const handleSaveTags = async (nextTags: string) => {
    if (!selectedRepo) return
    try {
      await upsertTags(selectedRepo.path, nextTags)
      messageApi.success("标签已更新")
      setTagModalOpen(false)
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
    } catch (error) {
      messageApi.error(`更新标签失败：${(error as Error).message}`)
    }
  }

  const handleRunAction = async (actionId: string, repoPath: string) => {
    try {
      await runAction(actionId, repoPath)
    } catch (error) {
      messageApi.error(`执行操作失败：${(error as Error).message}`)
    }
  }

  return (
    <AntApp>
      {contextHolder}
      <div className="app-shell">
        <div className="toolbar">
          <Input.Search
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 owner/repo、路径或标签"
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="按标签过滤"
            value={tag}
            onChange={(value) => setTag(value)}
            style={{ minWidth: 180 }}
            options={tagOptions.map((item) => ({ label: item, value: item }))}
          />
          <Space>
            <Button onClick={handleRefresh}>刷新缓存</Button>
          </Space>
        </div>
        <div className="content-area">
          <div className="list-pane">
            <RepoList
              loading={loadingRepos}
              repos={repos}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
            />
          </div>
          <div className="preview-pane">
            <ActionsBar
              disabled={!selectedRepo}
              onAddTag={() => setTagModalOpen(true)}
              onRefreshCache={handleRefresh}
              onRunAction={handleRunAction}
              repo={selectedRepo}
            />
            <PreviewPanel loading={loadingPreview} preview={preview} repo={selectedRepo} />
          </div>
        </div>
        <TagModal
          open={tagModalOpen}
          repo={selectedRepo}
          onCancel={() => setTagModalOpen(false)}
          onSave={handleSaveTags}
        />
      </div>
    </AntApp>
  )
}
