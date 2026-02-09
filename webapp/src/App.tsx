import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntApp, message } from 'antd';
import { fetchTagOptions, runAction } from './api';
import ActionsBar from './components/ActionsBar';
import PreviewPanel from './components/PreviewPanel';
import QuickTagsModal from './components/QuickTagsModal';
import RepoList from './components/RepoList';
import RepoLinksModal from './components/RepoLinksModal';
import SettingsModal from './components/SettingsModal';
import TagModal from './components/TagModal';
import TagRenameModal from './components/TagRenameModal';
import Toolbar from './components/Toolbar';
import { useActions } from './hooks/useActions';
import { useConfigManager } from './hooks/useConfigManager';
import { usePreview } from './hooks/usePreview';
import { useRepos } from './hooks/useRepos';
import { useSearchFilter } from './hooks/useSearchFilter';
import { useTags } from './hooks/useTags';
import { formatTagLabel, normalizeTagValue } from './utils/tagUtils';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickTagsOpen, setQuickTagsOpen] = useState(false);
  const [quickTagsDraft, setQuickTagsDraft] = useState<string[]>([]);
  const [repoLinksOpen, setRepoLinksOpen] = useState(false);
  const [hoveredConfigKey, setHoveredConfigKey] = useState<string | null>(null);
  const { query, setQuery, tag, setTag, debouncedQuery } = useSearchFilter();
  const [messageApi, contextHolder] = message.useMessage();
  const createId = useCallback(() => `${Date.now()}-${Math.random().toString(16).slice(2)}`, []);
  const [tagOptions, setTagOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [tagModalOptions, setTagModalOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const {
    repos,
    selectedPath,
    selectedRepo,
    setSelectedPath,
    loadingRepos,
    refreshingCache,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    reloadRepos,
    handleRefreshCache,
  } = useRepos({ debouncedQuery, tag, messageApi });
  const { preview, loadingPreview } = usePreview(selectedPath, messageApi);
  const { actions } = useActions(messageApi);
  const {
    configPaths,
    configText,
    setConfigText,
    loadingConfig,
    savingConfig,
    savingRepoLinks,
    configLoadedOnce,
    configEditorOpen,
    setConfigEditorOpen,
    quickTagsConfig,
    repoLinksConfig,
    repoLinksMap,
    savingQuickTags,
    currentRepoLinkKey,
    setCurrentRepoLinkKey,
    pendingRepoLinkKey,
    setPendingRepoLinkKey,
    currentRepoLinksGroup,
    currentRepoLinksIndex,
    handleRepoLinksChange,
    handleRepoLinkUpdate,
    handleRepoLinkRemove,
    handleRepoLinkAdd,
    ensureRepoLinksForKey,
    handleSaveConfig,
    handleSaveRepoLinks,
    handleSaveQuickTags,
  } = useConfigManager({ settingsOpen, repoLinksOpen, messageApi, createId });
  const reloadTagOptions = useCallback(async () => {
    try {
      const tags = await fetchTagOptions();
      const normalized = tags.map((item) => ({
        tag: item.tag,
        count: item.count,
        label: formatTagLabel(item.tag),
      }));
      const sorted = normalized.slice().sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.label.localeCompare(b.label);
      });
      setTagOptions(
        sorted.map((item) => ({
          label: `${item.label} (${item.count} used)`,
          value: item.tag,
        })),
      );
      setTagModalOptions(
        sorted.map((item) => ({
          label: `${item.label} (${item.count} used)`,
          value: item.tag,
        })),
      );
    } catch (error) {
      messageApi.error(`获取标签选项失败：${(error as Error).message}`);
    }
  }, [messageApi]);
  const {
    tagModalOpen,
    tagModalRepo,
    tagModalMode,
    setTagModalOpen,
    tagRenameOpen,
    tagRenameValue,
    tagRenameSaving,
    setTagRenameOpen,
    handleAddTag,
    handleRemoveTag,
    handleRenameTag,
    handleSaveTagRename,
    handleSaveTags,
  } = useTags({ messageApi, reloadRepos, reloadTagOptions });

  useEffect(() => {
    void reloadTagOptions();
  }, [reloadTagOptions]);

  const quickTagOptions = useMemo(
    () =>
      quickTagsConfig
        .map((item) => ({
          label: formatTagLabel(item),
          value: normalizeTagValue(item),
        }))
        .filter((item) => item.label && item.value),
    [quickTagsConfig],
  );

  const handleQuickTagClick = useCallback(
    (value: string) => {
      setTag(value === tag ? undefined : value);
    },
    [tag, setTag],
  );

  useEffect(() => {
    if (quickTagsOpen) {
      setQuickTagsDraft(quickTagsConfig);
    }
  }, [quickTagsOpen, quickTagsConfig]);

  useEffect(() => {
    if (!pendingRepoLinkKey || !configLoadedOnce) {
      return;
    }

    const next = ensureRepoLinksForKey(repoLinksConfig, pendingRepoLinkKey);
    setPendingRepoLinkKey(null);
    handleRepoLinksChange(next);
  }, [
    pendingRepoLinkKey,
    configLoadedOnce,
    repoLinksConfig,
    ensureRepoLinksForKey,
    handleRepoLinksChange,
    setPendingRepoLinkKey,
  ]);

  useEffect(() => {
    if (!repoLinksOpen || !currentRepoLinkKey || !configLoadedOnce) {
      return;
    }

    const next = ensureRepoLinksForKey(repoLinksConfig, currentRepoLinkKey);
    handleRepoLinksChange(next);
  }, [
    repoLinksOpen,
    currentRepoLinkKey,
    configLoadedOnce,
    repoLinksConfig,
    ensureRepoLinksForKey,
    handleRepoLinksChange,
  ]);

  const handleSaveConfigClick = async () => {
    const result = await handleSaveConfig();

    if (!result) {
      return;
    }

    await reloadRepos();
    await reloadTagOptions();
  };

  const handleRefreshCacheClick = async () => {
    await handleRefreshCache();
    await reloadTagOptions();
  };

  const handleSaveRepoLinksClick = async () => {
    const ok = await handleSaveRepoLinks();

    if (ok) {
      setRepoLinksOpen(false);
    }
  };

  const handleSaveQuickTagsClick = async () => {
    const ok = await handleSaveQuickTags(quickTagsDraft);

    if (ok) {
      setQuickTagsOpen(false);
    }
  };

  const handleRepoLinksGroupRepoChange = useCallback(
    (groupIndex: number, value: string) => {
      const next = repoLinksConfig.map((item, currentIndex) =>
        currentIndex === groupIndex ? { ...item, repo: value } : item,
      );
      handleRepoLinksChange(next);
    },
    [repoLinksConfig, handleRepoLinksChange],
  );

  const handleRunAction = async (actionId: string, repoPath: string) => {
    if (actionId === 'web.edit-repo-links') {
      const repo = repos.find((item) => item.record.fullPath === repoPath);

      if (!repo) {
        return;
      }

      const previewRepoKey =
        preview?.data.record.fullPath === repoPath && preview.data.record.repoKey !== '-'
          ? preview.data.record.repoKey
          : '';
      const repoKey =
        previewRepoKey ||
        (repo.record.repoKey && repo.record.repoKey !== '-'
          ? repo.record.repoKey
          : repo.record.relativePath);
      setRepoLinksOpen(true);
      setCurrentRepoLinkKey(repoKey);

      if (configLoadedOnce) {
        const next = ensureRepoLinksForKey(repoLinksConfig, repoKey);
        handleRepoLinksChange(next);
      } else {
        setPendingRepoLinkKey(repoKey);
      }

      return;
    }

    try {
      await runAction(actionId, repoPath);
    } catch (error) {
      messageApi.error(`执行操作失败：${(error as Error).message}`);
    }
  };

  return (
    <AntApp>
      {contextHolder}
      <div className="app-shell">
          <Toolbar
          query={query}
          onQueryChange={setQuery}
          tag={tag}
          onTagChange={setTag}
          tagOptions={tagOptions}
          quickTagOptions={quickTagOptions}
          onQuickTagClick={handleQuickTagClick}
          onManageQuickTags={() => setQuickTagsOpen(true)}
          refreshingCache={refreshingCache}
            onRefresh={handleRefreshCacheClick}
          onOpenSettings={() => setSettingsOpen(true)}
        />
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
              onRenameTag={handleRenameTag}
              onPageChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
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
          tagOptions={tagModalOptions}
          onCancel={() => setTagModalOpen(false)}
          onSave={handleSaveTags}
        />
        <TagRenameModal
          open={tagRenameOpen}
          currentTag={tagRenameValue}
          saving={tagRenameSaving}
          onCancel={() => setTagRenameOpen(false)}
          onSave={handleSaveTagRename}
        />
        <QuickTagsModal
          open={quickTagsOpen}
          onCancel={() => setQuickTagsOpen(false)}
          onSave={handleSaveQuickTagsClick}
          saving={savingQuickTags}
          quickTagsConfig={quickTagsDraft}
          tagOptions={tagOptions}
          onQuickTagsChange={setQuickTagsDraft}
        />
        <SettingsModal
          open={settingsOpen}
          onCancel={() => setSettingsOpen(false)}
          onSave={handleSaveConfigClick}
          saving={savingConfig}
          configPaths={configPaths}
          hoveredConfigKey={hoveredConfigKey}
          onHoveredConfigKeyChange={setHoveredConfigKey}
          configEditorOpen={configEditorOpen}
          onToggleConfigEditor={() => setConfigEditorOpen((prev) => !prev)}
          configText={configText}
          onConfigTextChange={setConfigText}
          loadingConfig={loadingConfig}
          messageApi={messageApi}
        />
        <RepoLinksModal
          open={repoLinksOpen}
          onCancel={() => {
            setRepoLinksOpen(false);
            setCurrentRepoLinkKey(null);
            setPendingRepoLinkKey(null);
          }}
          onSave={handleSaveRepoLinksClick}
          saving={savingRepoLinks}
          currentRepoLinksGroup={currentRepoLinksGroup}
          currentRepoLinksIndex={currentRepoLinksIndex}
          repoLinksConfig={repoLinksConfig}
          onRepoLinksGroupRepoChange={handleRepoLinksGroupRepoChange}
          onRepoLinkUpdate={handleRepoLinkUpdate}
          onRepoLinkRemove={handleRepoLinkRemove}
          onRepoLinkAdd={handleRepoLinkAdd}
        />
      </div>
    </AntApp>
  );
}
