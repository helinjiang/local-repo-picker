import { useEffect, useMemo, useState } from "react"
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from "@ant-design/icons"
import { App as AntApp, Button, Input, Modal, Select, Space, Tag, Tooltip, Tree, message } from "antd"
import type { ActionInfo, AppConfig, ConfigPaths, FixedLink, RepoItem, RepoPreviewResult } from "./types"
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
  const [repoLinksOpen, setRepoLinksOpen] = useState(false)
  const [configPaths, setConfigPaths] = useState<ConfigPaths | null>(null)
  const [configText, setConfigText] = useState("")
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingRepoLinks, setSavingRepoLinks] = useState(false)
  const [refreshingCache, setRefreshingCache] = useState(false)
  const [hoveredConfigKey, setHoveredConfigKey] = useState<string | null>(null)
  const [configEditorOpen, setConfigEditorOpen] = useState(false)
  const [quickTagsConfig, setQuickTagsConfig] = useState<string[]>([])
  const [repoLinksConfig, setRepoLinksConfig] = useState<
    { id: string; repo: string; links: { id: string; label: string; url: string }[] }[]
  >([])
  const [pendingRepoLinkKey, setPendingRepoLinkKey] = useState<string | null>(null)
  const [currentRepoLinkKey, setCurrentRepoLinkKey] = useState<string | null>(null)
  const [configLoadedOnce, setConfigLoadedOnce] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const [messageApi, contextHolder] = message.useMessage()

  const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const ensureRepoLinksForKey = (
    current: { id: string; repo: string; links: { id: string; label: string; url: string }[] }[],
    repoKey: string
  ) => {
    const normalized = repoKey.trim()
    if (!normalized) return current
    const index = current.findIndex((group) => group.repo.trim() === normalized)
    if (index === -1) {
      return [
        ...current,
        {
          id: createId(),
          repo: normalized,
          links: [{ id: createId(), label: "", url: "" }]
        }
      ]
    }
    const group = current[index]
    if (!group) return current
    if (group.links.length > 0) return current
    const next = current.map((item, currentIndex) =>
      currentIndex === index
        ? {
            ...item,
            links: [{ id: createId(), label: "", url: "" }]
          }
        : item
    )
    return next
  }

  const formatTagLabel = (raw: string) => raw.replace(/^\[(.*)\]$/, "$1")
  const normalizeTagValue = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed
    }
    return `[${trimmed}]`
  }

  const tagOptions = useMemo(() => {
    const tagSet = new Set<string>()
    repos.forEach((repo) => repo.tags.forEach((item) => tagSet.add(item)))
    return Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ label: formatTagLabel(item), value: item }))
  }, [repos])

  const quickTagOptions = useMemo(
    () =>
      quickTagsConfig
        .map((item) => ({
          label: formatTagLabel(item),
          value: normalizeTagValue(item)
        }))
        .filter((item) => item.label && item.value),
    [quickTagsConfig]
  )

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.path === selectedPath) ?? null,
    [repos, selectedPath]
  )

  const repoLinksMap = useMemo(
    () =>
      Object.fromEntries(
        repoLinksConfig
          .map((group) => ({
            repo: group.repo.trim(),
            links: group.links
              .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
              .filter((link) => link.label && link.url)
          }))
          .filter((group) => group.repo && group.links.length > 0)
          .map((group) => [group.repo, group.links])
      ),
    [repoLinksConfig]
  )

  const currentRepoLinksGroup = useMemo(() => {
    if (!currentRepoLinkKey) return null
    const key = currentRepoLinkKey.trim()
    if (!key) return null
    return repoLinksConfig.find((group) => group.repo.trim() === key) ?? null
  }, [repoLinksConfig, currentRepoLinkKey])

  const currentRepoLinksIndex = useMemo(() => {
    if (!currentRepoLinksGroup) return -1
    return repoLinksConfig.findIndex((group) => group.id === currentRepoLinksGroup.id)
  }, [repoLinksConfig, currentRepoLinksGroup])

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
    let cancelled = false
    async function loadConfig() {
      setLoadingConfig(true)
      try {
        const data = await fetchConfig()
        if (cancelled) return
        setConfigPaths(data.paths)
        setConfigText(JSON.stringify(data.config, null, 2))
        setQuickTagsConfig(data.config.webQuickTags ?? [])
        const repoLinks = data.config.webRepoLinks ?? {}
        setRepoLinksConfig(
          Object.entries(repoLinks).map(([repo, links]) => ({
            id: createId(),
            repo,
            links: links.map((link) => ({ id: createId(), label: link.label, url: link.url }))
          }))
        )
        setConfigLoadedOnce(true)
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取配置失败：${(error as Error).message}`)
        }
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    }
    if (settingsOpen || repoLinksOpen || !configLoadedOnce) {
      void loadConfig()
    }
    return () => {
      cancelled = true
    }
  }, [settingsOpen, repoLinksOpen, messageApi, configLoadedOnce])

  useEffect(() => {
    if (!pendingRepoLinkKey || !configLoadedOnce) return
    const next = ensureRepoLinksForKey(repoLinksConfig, pendingRepoLinkKey)
    setPendingRepoLinkKey(null)
    handleRepoLinksChange(next)
  }, [pendingRepoLinkKey, configLoadedOnce, repoLinksConfig])

  useEffect(() => {
    if (!repoLinksOpen || !currentRepoLinkKey || !configLoadedOnce) return
    const next = ensureRepoLinksForKey(repoLinksConfig, currentRepoLinkKey)
    handleRepoLinksChange(next)
  }, [repoLinksOpen, currentRepoLinkKey, configLoadedOnce, repoLinksConfig])

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
    if (refreshingCache) return
    setRefreshingCache(true)
    try {
      await refreshCache()
      messageApi.success("缓存已刷新")
      const data = await fetchRepos({ q: debouncedQuery, tag, page, pageSize })
      setRepos(data.items)
      setTotal(data.total)
    } catch (error) {
      messageApi.error(`刷新缓存失败：${(error as Error).message}`)
    } finally {
      setRefreshingCache(false)
    }
  }

  const handleSaveTags = async (nextTags: string) => {
    if (!tagModalRepo) return
    try {
      if (tagModalMode === "add") {
        const parsed = nextTags
          .split(/[\s,]+/)
          .map(stripTagBrackets)
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
    if (actionId === "web.edit-repo-links") {
      const repo = repos.find((item) => item.path === repoPath)
      if (!repo) return
      const previewRepoKey =
        preview?.data.path === repoPath && preview.data.repoKey !== "-"
          ? preview.data.repoKey
          : ""
      const repoKey = previewRepoKey || repo.ownerRepo
      setRepoLinksOpen(true)
      setCurrentRepoLinkKey(repoKey)
      if (configLoadedOnce) {
        const next = ensureRepoLinksForKey(repoLinksConfig, repoKey)
        handleRepoLinksChange(next)
      } else {
        setPendingRepoLinkKey(repoKey)
      }
      return
    }
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
    parsed.webQuickTags = quickTagsConfig
    parsed.webRepoLinks = Object.fromEntries(
      repoLinksConfig
        .map((group) => ({
          repo: group.repo.trim(),
          links: group.links
            .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
            .filter((link) => link.label && link.url)
        }))
        .filter((group) => group.repo && group.links.length > 0)
        .map((group) => [group.repo, group.links])
    )
    setSavingConfig(true)
    try {
      const result = await saveConfig(parsed)
      setConfigText(JSON.stringify(result.config, null, 2))
      setQuickTagsConfig(result.config.webQuickTags ?? [])
      const repoLinks = result.config.webRepoLinks ?? {}
      setRepoLinksConfig(
        Object.entries(repoLinks).map(([repo, links]) => ({
          id: createId(),
          repo,
          links: links.map((link) => ({ id: createId(), label: link.label, url: link.url }))
        }))
      )
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

  const handleSaveRepoLinks = async () => {
    let parsed: AppConfig
    try {
      parsed = JSON.parse(configText) as AppConfig
    } catch (error) {
      messageApi.error(`配置 JSON 无效：${(error as Error).message}`)
      return
    }
    parsed.webRepoLinks = Object.fromEntries(
      repoLinksConfig
        .map((group) => ({
          repo: group.repo.trim(),
          links: group.links
            .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
            .filter((link) => link.label && link.url)
        }))
        .filter((group) => group.repo && group.links.length > 0)
        .map((group) => [group.repo, group.links])
    )
    setSavingRepoLinks(true)
    try {
      const result = await saveConfig(parsed)
      setConfigText(JSON.stringify(result.config, null, 2))
      const repoLinks = result.config.webRepoLinks ?? {}
      setRepoLinksConfig(
        Object.entries(repoLinks).map(([repo, links]) => ({
          id: createId(),
          repo,
          links: links.map((link) => ({ id: createId(), label: link.label, url: link.url }))
        }))
      )
      messageApi.success("固定链接已更新")
      setRepoLinksOpen(false)
    } catch (error) {
      messageApi.error(`更新固定链接失败：${(error as Error).message}`)
    } finally {
      setSavingRepoLinks(false)
    }
  }

  const stripTagBrackets = (raw: string) => raw.replace(/^\[(.*)\]$/, "$1").trim()

  const handleQuickTagsChange = (values: string[]) => {
    const next = values.map(stripTagBrackets).filter(Boolean)
    setQuickTagsConfig(next)
    try {
      const parsed = JSON.parse(configText) as AppConfig
      const updated = { ...parsed, webQuickTags: next }
      setConfigText(JSON.stringify(updated, null, 2))
    } catch {
      setConfigText((prev) => prev)
    }
  }

  const handleRepoLinksChange = (
    next: { id: string; repo: string; links: { id: string; label: string; url: string }[] }[]
  ) => {
    setRepoLinksConfig(next)
    try {
      const parsed = JSON.parse(configText) as AppConfig
      const updated = {
        ...parsed,
        webRepoLinks: Object.fromEntries(
          next
            .map((group) => ({
              repo: group.repo.trim(),
              links: group.links
                .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
                .filter((link) => link.label && link.url)
            }))
            .filter((group) => group.repo && group.links.length > 0)
            .map((group) => [group.repo, group.links])
        )
      }
      setConfigText(JSON.stringify(updated, null, 2))
    } catch {
      setConfigText((prev) => prev)
    }
  }

  const handleRepoLinksUpdate = (
    index: number,
    links: { id: string; label: string; url: string }[]
  ) => {
    const next = repoLinksConfig.map((group, current) =>
      current === index ? { ...group, links } : group
    )
    handleRepoLinksChange(next)
  }

  const handleRepoLinkUpdate = (groupIndex: number, linkIndex: number, patch: Partial<FixedLink>) => {
    const group = repoLinksConfig[groupIndex]
    if (!group) return
    const nextLinks = group.links.map((link, current) =>
      current === linkIndex ? { ...link, ...patch } : link
    )
    handleRepoLinksUpdate(groupIndex, nextLinks)
  }

  const handleRepoLinkRemove = (groupIndex: number, linkIndex: number) => {
    const group = repoLinksConfig[groupIndex]
    if (!group) return
    const nextLinks = group.links.filter((_, current) => current !== linkIndex)
    handleRepoLinksUpdate(groupIndex, nextLinks)
  }

  const handleRepoLinkAdd = (groupIndex: number) => {
    const group = repoLinksConfig[groupIndex]
    if (!group) return
    handleRepoLinksUpdate(groupIndex, [
      ...group.links,
      { id: createId(), label: "", url: "" }
    ])
  }

  return (
    <AntApp>
      {contextHolder}
      <div className="app-shell">
        <div className="toolbar">
          <div className="toolbar-row">
            <div className="toolbar-group toolbar-group--filters">
              <Input.Search
                allowClear
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 owner/repo、路径或标签"
                style={{ width: 320 }}
              />
            </div>
            <div className="toolbar-group toolbar-group--actions">
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshingCache}>刷新缓存</Button>
                <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>配置</Button>
              </Space>
            </div>
          </div>
          <div className="toolbar-row">
            <div className="toolbar-group toolbar-group--filters">
              <Select
                allowClear
                placeholder="按标签过滤"
                value={tag}
                onChange={(value) => setTag(value)}
                style={{ width: 320 }}
                options={tagOptions}
              />
            </div>
            {quickTagOptions.length > 0 ? (
              <div className="toolbar-group toolbar-group--quick-tags">
                <Space size={[6, 6]} wrap>
                  {quickTagOptions.map((item) => (
                    <Tag
                      key={item.value}
                      color={item.value === tag ? "blue" : undefined}
                      style={{ cursor: "pointer" }}
                      onClick={() => setTag(item.value === tag ? undefined : item.value)}
                    >
                      {item.label}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : (
              <div className="toolbar-group toolbar-group--quick-tags toolbar-group--quick-tags-empty">
                <span className="toolbar-placeholder">暂无快速标签</span>
              </div>
            )}
          </div>
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
            <PreviewPanel
              loading={loadingPreview}
              preview={preview}
              repo={selectedRepo}
              repoLinks={repoLinksMap}
            />
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
          <div style={{ fontWeight: 600, marginBottom: 8 }}>快速筛选标签</div>
          <Select
            mode="tags"
            placeholder="输入标签并回车，多个标签可用空格或逗号"
            value={quickTagsConfig}
            onChange={handleQuickTagsChange}
            tokenSeparators={[",", " "]}
            options={tagOptions.map((item) => ({ label: item.label, value: item.label }))}
            style={{ width: "100%" }}
          />
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
        <Modal
          title="固定链接"
          open={repoLinksOpen}
          onCancel={() => {
            setRepoLinksOpen(false)
            setCurrentRepoLinkKey(null)
            setPendingRepoLinkKey(null)
          }}
          onOk={handleSaveRepoLinks}
          confirmLoading={savingRepoLinks}
          okText="保存"
          cancelText="关闭"
          width={720}
        >
          {currentRepoLinksGroup ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #f0f0f0",
                background: "#fafafa",
                marginBottom: 12
              }}
            >
              <div style={{ fontWeight: 600 }}>当前仓库</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#595959" }}>
                {currentRepoLinksGroup.repo}
              </div>
              <div style={{ fontSize: 12, color: "#8c8c8c" }}>{selectedRepo?.path ?? "-"}</div>
            </div>
          ) : null}
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {!currentRepoLinksGroup ? (
              <div style={{ color: "#8c8c8c" }}>未选中仓库</div>
            ) : (
              <div key={currentRepoLinksGroup.id} style={{ width: "100%", padding: 12, border: "1px solid #f0f0f0", borderRadius: 8 }}>
                <Space size="middle" style={{ width: "100%" }}>
                  <Input
                    placeholder="repoKey，如 github/namespace/repo-name"
                    value={currentRepoLinksGroup.repo}
                    disabled
                  />
                </Space>
                <Space direction="vertical" size="small" style={{ width: "100%", marginTop: 12 }}>
                  {currentRepoLinksGroup.links.length === 0 ? (
                    <div style={{ color: "#8c8c8c" }}>未配置链接</div>
                  ) : null}
                  {currentRepoLinksGroup.links.map((link, linkIndex) => (
                    <Space key={link.id} size="middle" style={{ width: "100%" }}>
                      <Input
                        placeholder="名称"
                        value={link.label}
                        onChange={(event) =>
                          handleRepoLinkUpdate(currentRepoLinksIndex, linkIndex, {
                            label: event.target.value
                          })
                        }
                        style={{ width: 160 }}
                      />
                      <Input
                        placeholder="https://example.com/{ownerRepo}"
                        value={link.url}
                        onChange={(event) =>
                          handleRepoLinkUpdate(currentRepoLinksIndex, linkIndex, {
                            url: event.target.value
                          })
                        }
                      />
                      <Tooltip title="删除链接">
                        <Button
                          icon={<DeleteOutlined />}
                          type="text"
                          onClick={() => handleRepoLinkRemove(currentRepoLinksIndex, linkIndex)}
                        >
                        </Button>
                      </Tooltip>
                    </Space>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => handleRepoLinkAdd(currentRepoLinksIndex)}>
                    添加链接
                  </Button>
                </Space>
              </div>
            )}
            <div style={{ color: "#8c8c8c", fontSize: 12 }}>
              Key 为 repoKey（remoteTag/repoPath），匹配后展示。支持占位符：{`{ownerRepo}`}、{`{path}`}、{`{originUrl}`}
            </div>
          </Space>
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
