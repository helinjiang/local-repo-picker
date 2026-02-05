import { useEffect, useMemo, useState } from "react"
import { CopyOutlined, EditOutlined, ReloadOutlined, SettingOutlined } from "@ant-design/icons"
import { App as AntApp, Button, Input, Modal, Select, Space, Tooltip, Tree, message } from "antd"
import type { ActionInfo, AppConfig, ConfigPaths, RepoItem, RepoPreviewResult } from "./types"
import {
  fetchActions,
  fetchConfig,
  fetchPreview,
  fetchRepos,
  refreshCache,
  runAction,
  saveConfig,
  updateTags,
  upsertTags
} from "./api"
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
  const [actions, setActions] = useState<ActionInfo[]>([])
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(200)
  const [total, setTotal] = useState(0)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagModalRepo, setTagModalRepo] = useState<RepoItem | null>(null)
  const [tagModalMode, setTagModalMode] = useState<"add" | "edit">("add")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [configPaths, setConfigPaths] = useState<ConfigPaths | null>(null)
  const [configText, setConfigText] = useState("")
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [hoveredConfigKey, setHoveredConfigKey] = useState<string | null>(null)
  const [configEditorOpen, setConfigEditorOpen] = useState(false)
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
    let cancelled = false
    async function loadActions() {
      try {
        const data = await fetchActions()
        if (!cancelled) setActions(data)
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取 Actions 失败：${(error as Error).message}`)
        }
      }
    }
    void loadActions()
    return () => {
      cancelled = true
    }
  }, [messageApi])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, tag])

  useEffect(() => {
    if (!settingsOpen) return
    let cancelled = false
    async function loadConfig() {
      setLoadingConfig(true)
      try {
        const data = await fetchConfig()
        if (cancelled) return
        setConfigPaths(data.paths)
        setConfigText(JSON.stringify(data.config, null, 2))
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取配置失败：${(error as Error).message}`)
        }
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    }
    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [settingsOpen, messageApi])

  useEffect(() => {
    if (!settingsOpen) {
      setConfigEditorOpen(false)
    }
  }, [settingsOpen])

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
    if (!tagModalRepo) return
    try {
      if (tagModalMode === "add") {
        const parsed = nextTags
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map(normalizeTag)
          .filter(Boolean)
        if (parsed.length === 0) {
          setTagModalOpen(false)
          setTagModalRepo(null)
          return
        }
        await updateTags(tagModalRepo.path, { add: parsed })
        messageApi.success("标签已新增")
      } else {
        await upsertTags(tagModalRepo.path, nextTags)
        messageApi.success("标签已更新")
      }
      setTagModalOpen(false)
      setTagModalRepo(null)
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
    } catch (error) {
      messageApi.error(`更新标签失败：${(error as Error).message}`)
    }
  }

  const handleAddTag = (repo: RepoItem) => {
    setTagModalRepo(repo)
    setTagModalMode("add")
    setTagModalOpen(true)
  }

  const handleRemoveTag = async (repo: RepoItem, removedTag: string) => {
    try {
      await updateTags(repo.path, { remove: [removedTag] })
      messageApi.success("标签已删除")
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
    } catch (error) {
      messageApi.error(`删除标签失败：${(error as Error).message}`)
    }
  }

  const handleRunAction = async (actionId: string, repoPath: string) => {
    try {
      await runAction(actionId, repoPath)
    } catch (error) {
      messageApi.error(`执行操作失败：${(error as Error).message}`)
    }
  }

  const handleSaveConfig = async () => {
    let parsed: AppConfig
    try {
      parsed = JSON.parse(configText) as AppConfig
    } catch (error) {
      messageApi.error(`配置 JSON 无效：${(error as Error).message}`)
      return
    }
    setSavingConfig(true)
    try {
      const result = await saveConfig(parsed)
      setConfigText(JSON.stringify(result.config, null, 2))
      messageApi.success(`配置已更新并刷新缓存（${result.repoCount}）`)
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
      setPage(data.page)
      setPageSize(data.pageSize)
    } catch (error) {
      messageApi.error(`更新配置失败：${(error as Error).message}`)
    } finally {
      setSavingConfig(false)
    }
  }

  const normalizeTag = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed
    }
    return `[${trimmed}]`
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
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新缓存</Button>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>配置</Button>
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
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onPageChange={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
            />
          </div>
          <div className="preview-pane">
            <ActionsBar
              disabled={!selectedRepo}
              actions={actions}
              onRunAction={handleRunAction}
              repo={selectedRepo}
            />
            <PreviewPanel loading={loadingPreview} preview={preview} repo={selectedRepo} />
          </div>
        </div>
        <TagModal
          open={tagModalOpen}
          repo={tagModalRepo}
          mode={tagModalMode}
          onCancel={() => {
            setTagModalOpen(false)
            setTagModalRepo(null)
          }}
          onSave={handleSaveTags}
        />
        <Modal
          title="配置"
          open={settingsOpen}
          onCancel={() => setSettingsOpen(false)}
          onOk={handleSaveConfig}
          confirmLoading={savingConfig}
          okText="保存并刷新缓存"
          cancelText="关闭"
          width={720}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>可编辑配置</div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
            onMouseEnter={() => setHoveredConfigKey("config.json")}
            onMouseLeave={() => setHoveredConfigKey(null)}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "monospace"
              }}
            >
              {configPaths?.configFile ?? "-"}
            </span>
            {configPaths?.configFile && hoveredConfigKey === "config.json" ? (
              <Tooltip title="复制路径">
                <Button
                  size="small"
                  type="text"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void copyPathToClipboard(configPaths.configFile, messageApi)
                  }}
                  icon={<CopyOutlined />}
                >
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip title={configEditorOpen ? "收起编辑" : "编辑配置"}>
              <Button
                size="small"
                type="text"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setConfigEditorOpen((prev) => !prev)
                }}
                icon={<EditOutlined />}
              >
              </Button>
            </Tooltip>
          </div>
          {configEditorOpen ? (
            <div style={{ marginTop: 12 }}>
              <Input.TextArea
                value={configText}
                onChange={(event) => setConfigText(event.target.value)}
                autoSize={{ minRows: 12, maxRows: 20 }}
                placeholder={loadingConfig ? "加载配置中..." : "请输入配置 JSON"}
                style={{ fontFamily: "monospace" }}
              />
            </div>
          ) : null}
          <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>系统配置</div>
          <Tree
            blockNode
            defaultExpandAll
            treeData={buildConfigTree(configPaths)}
            titleRender={(node) => (
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                onMouseEnter={() => setHoveredConfigKey(node.key)}
                onMouseLeave={() => setHoveredConfigKey(null)}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {node.title}
                </span>
                {node.path && hoveredConfigKey === node.key ? (
                  <Tooltip title="复制路径">
                    <Button
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (!node.path) return
                        void copyPathToClipboard(node.path, messageApi)
                      }}
                      icon={<CopyOutlined />}
                    >
                    </Button>
                  </Tooltip>
                ) : null}
              </div>
            )}
          />
        </Modal>
      </div>
    </AntApp>
  )
}

type ConfigTreeNode = {
  title: string
  key: string
  path?: string
  isLeaf?: boolean
  children?: ConfigTreeNode[]
}

function buildConfigTree(paths: ConfigPaths | null): ConfigTreeNode[] {
  if (!paths) {
    return [
      {
        title: "加载中",
        key: "loading"
      }
    ]
  }
  const cacheFiles = [
    { title: "cache.json", key: "cache.json", path: paths.cacheFile, isLeaf: true }
  ]
  const dataFiles = [
    { title: "repo_tags.tsv", key: "repo_tags.tsv", path: paths.manualTagsFile, isLeaf: true },
    { title: "lru.txt", key: "lru.txt", path: paths.lruFile, isLeaf: true }
  ]
  return [
    {
      title: paths.dataDir,
      key: paths.dataDir,
      path: paths.dataDir,
      children: dataFiles
    },
    {
      title: paths.cacheDir,
      key: paths.cacheDir,
      path: paths.cacheDir,
      children: cacheFiles
    }
  ]
}

async function copyPathToClipboard(path: string, messageApi: ReturnType<typeof message.useMessage>[0]) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("clipboard unavailable")
    }
    await navigator.clipboard.writeText(path)
    messageApi.success("路径已复制")
  } catch (error) {
    messageApi.error(`复制失败：${(error as Error).message}`)
  }
}
