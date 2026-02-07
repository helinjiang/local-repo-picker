import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { message } from 'antd';
import type { AppConfig, ConfigPaths, FixedLink } from '../types';
import { fetchConfig, saveConfig } from '../api';
import { stripTagBrackets } from '../utils/tagUtils';

export type RepoLinksGroup = {
  id: string;
  repo: string;
  links: { id: string; label: string; url: string }[];
};

export function useConfigManager(params: {
  settingsOpen: boolean;
  repoLinksOpen: boolean;
  messageApi: ReturnType<typeof message.useMessage>[0];
  createId: () => string;
}) {
  const { settingsOpen, repoLinksOpen, messageApi, createId } = params;
  const [configPaths, setConfigPaths] = useState<ConfigPaths | null>(null);
  const [configText, setConfigText] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingRepoLinks, setSavingRepoLinks] = useState(false);
  const [configLoadedOnce, setConfigLoadedOnce] = useState(false);
  const [configEditorOpen, setConfigEditorOpen] = useState(false);
  const [quickTagsConfig, setQuickTagsConfig] = useState<string[]>([]);
  const [repoLinksConfig, setRepoLinksConfig] = useState<RepoLinksGroup[]>([]);
  const [pendingRepoLinkKey, setPendingRepoLinkKey] = useState<string | null>(null);
  const [currentRepoLinkKey, setCurrentRepoLinkKey] = useState<string | null>(null);
  const configTextRef = useRef(configText);

  useEffect(() => {
    configTextRef.current = configText;
  }, [configText]);

  const repoLinksMap = useMemo(
    () =>
      Object.fromEntries(
        repoLinksConfig
          .map((group) => ({
            repo: group.repo.trim(),
            links: group.links
              .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
              .filter((link) => link.label && link.url),
          }))
          .filter((group) => group.repo && group.links.length > 0)
          .map((group) => [group.repo, group.links]),
      ) as Record<string, FixedLink[]>,
    [repoLinksConfig],
  );

  const currentRepoLinksGroup = useMemo(() => {
    if (!currentRepoLinkKey) {
      return null;
    }

    const key = currentRepoLinkKey.trim();

    if (!key) {
      return null;
    }

    return repoLinksConfig.find((group) => group.repo.trim() === key) ?? null;
  }, [repoLinksConfig, currentRepoLinkKey]);

  const currentRepoLinksIndex = useMemo(() => {
    if (!currentRepoLinksGroup) {
      return -1;
    }

    return repoLinksConfig.findIndex((group) => group.id === currentRepoLinksGroup.id);
  }, [repoLinksConfig, currentRepoLinksGroup]);

  const handleRepoLinksChange = useCallback(
    (next: RepoLinksGroup[]) => {
      setRepoLinksConfig(next);

      try {
        const parsed = JSON.parse(configTextRef.current) as AppConfig;
        const updated = {
          ...parsed,
          webRepoLinks: Object.fromEntries(
            next
              .map((group) => ({
                repo: group.repo.trim(),
                links: group.links
                  .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
                  .filter((link) => link.label && link.url),
              }))
              .filter((group) => group.repo && group.links.length > 0)
              .map((group) => [group.repo, group.links]),
          ),
        };
        setConfigText(JSON.stringify(updated, null, 2));
      } catch {
        setConfigText((prev) => prev);
      }
    },
    [setConfigText],
  );

  const handleRepoLinksUpdate = useCallback(
    (index: number, links: { id: string; label: string; url: string }[]) => {
      const next = repoLinksConfig.map((group, current) =>
        current === index ? { ...group, links } : group,
      );
      handleRepoLinksChange(next);
    },
    [repoLinksConfig, handleRepoLinksChange],
  );

  const handleRepoLinkUpdate = useCallback(
    (groupIndex: number, linkIndex: number, patch: Partial<FixedLink>) => {
      const group = repoLinksConfig[groupIndex];

      if (!group) {
        return;
      }

      const nextLinks = group.links.map((link, current) =>
        current === linkIndex ? { ...link, ...patch } : link,
      );
      handleRepoLinksUpdate(groupIndex, nextLinks);
    },
    [repoLinksConfig, handleRepoLinksUpdate],
  );

  const handleRepoLinkRemove = useCallback(
    (groupIndex: number, linkIndex: number) => {
      const group = repoLinksConfig[groupIndex];

      if (!group) {
        return;
      }

      const nextLinks = group.links.filter((_, current) => current !== linkIndex);
      handleRepoLinksUpdate(groupIndex, nextLinks);
    },
    [repoLinksConfig, handleRepoLinksUpdate],
  );

  const handleRepoLinkAdd = useCallback(
    (groupIndex: number) => {
      const group = repoLinksConfig[groupIndex];

      if (!group) {
        return;
      }

      handleRepoLinksUpdate(groupIndex, [...group.links, { id: createId(), label: '', url: '' }]);
    },
    [repoLinksConfig, handleRepoLinksUpdate, createId],
  );

  const handleQuickTagsChange = useCallback(
    (values: string[]) => {
      const next = values.map(stripTagBrackets).filter(Boolean);
      setQuickTagsConfig(next);

      try {
        const parsed = JSON.parse(configTextRef.current) as AppConfig;
        const updated = { ...parsed, webQuickTags: next };
        setConfigText(JSON.stringify(updated, null, 2));
      } catch {
        setConfigText((prev) => prev);
      }
    },
    [setConfigText],
  );

  const ensureRepoLinksForKey = useCallback(
    (
      current: { id: string; repo: string; links: { id: string; label: string; url: string }[] }[],
      repoKey: string,
    ) => {
      const normalized = repoKey.trim();

      if (!normalized) {
        return current;
      }

      const index = current.findIndex((group) => group.repo.trim() === normalized);

      if (index === -1) {
        return [
          ...current,
          {
            id: createId(),
            repo: normalized,
            links: [{ id: createId(), label: '', url: '' }],
          },
        ];
      }

      const group = current[index];

      if (!group) {
        return current;
      }

      if (group.links.length > 0) {
        return current;
      }

      return current.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              links: [{ id: createId(), label: '', url: '' }],
            }
          : item,
      );
    },
    [createId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setLoadingConfig(true);

      try {
        const data = await fetchConfig();

        if (cancelled) {
          return;
        }

        setConfigPaths(data.paths);
        setConfigText(JSON.stringify(data.config, null, 2));
        setQuickTagsConfig(data.config.webQuickTags ?? []);
        const repoLinks = data.config.webRepoLinks ?? {};
        setRepoLinksConfig(
          Object.entries(repoLinks).map(([repo, links]) => ({
            id: createId(),
            repo,
            links: links.map((link) => ({ id: createId(), label: link.label, url: link.url })),
          })),
        );
        setConfigLoadedOnce(true);
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取配置失败：${(error as Error).message}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      }
    }

    if (settingsOpen || repoLinksOpen || !configLoadedOnce) {
      void loadConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [settingsOpen, repoLinksOpen, messageApi, configLoadedOnce, createId]);

  useEffect(() => {
    if (!settingsOpen) {
      setConfigEditorOpen(false);
    }
  }, [settingsOpen]);

  const handleSaveConfig = useCallback(async (): Promise<{ repoCount: number } | null> => {
    let parsed: AppConfig;

    try {
      parsed = JSON.parse(configText) as AppConfig;
    } catch (error) {
      messageApi.error(`配置 JSON 无效：${(error as Error).message}`);

      return null;
    }

    parsed.webQuickTags = quickTagsConfig;
    parsed.webRepoLinks = Object.fromEntries(
      repoLinksConfig
        .map((group) => ({
          repo: group.repo.trim(),
          links: group.links
            .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
            .filter((link) => link.label && link.url),
        }))
        .filter((group) => group.repo && group.links.length > 0)
        .map((group) => [group.repo, group.links]),
    );
    setSavingConfig(true);

    try {
      const result = await saveConfig(parsed);
      setConfigText(JSON.stringify(result.config, null, 2));
      setQuickTagsConfig(result.config.webQuickTags ?? []);
      const repoLinks = result.config.webRepoLinks ?? {};
      setRepoLinksConfig(
        Object.entries(repoLinks).map(([repo, links]) => ({
          id: createId(),
          repo,
          links: links.map((link) => ({ id: createId(), label: link.label, url: link.url })),
        })),
      );
      messageApi.success(`配置已更新并刷新缓存（${result.repoCount}）`);

      return { repoCount: result.repoCount };
    } catch (error) {
      messageApi.error(`更新配置失败：${(error as Error).message}`);

      return null;
    } finally {
      setSavingConfig(false);
    }
  }, [configText, quickTagsConfig, repoLinksConfig, messageApi, createId]);

  const handleSaveRepoLinks = useCallback(async (): Promise<boolean> => {
    let parsed: AppConfig;

    try {
      parsed = JSON.parse(configText) as AppConfig;
    } catch (error) {
      messageApi.error(`配置 JSON 无效：${(error as Error).message}`);

      return false;
    }

    parsed.webRepoLinks = Object.fromEntries(
      repoLinksConfig
        .map((group) => ({
          repo: group.repo.trim(),
          links: group.links
            .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
            .filter((link) => link.label && link.url),
        }))
        .filter((group) => group.repo && group.links.length > 0)
        .map((group) => [group.repo, group.links]),
    );
    setSavingRepoLinks(true);

    try {
      const result = await saveConfig(parsed);
      setConfigText(JSON.stringify(result.config, null, 2));
      const repoLinks = result.config.webRepoLinks ?? {};
      setRepoLinksConfig(
        Object.entries(repoLinks).map(([repo, links]) => ({
          id: createId(),
          repo,
          links: links.map((link) => ({ id: createId(), label: link.label, url: link.url })),
        })),
      );
      messageApi.success('固定链接已更新');

      return true;
    } catch (error) {
      messageApi.error(`更新固定链接失败：${(error as Error).message}`);

      return false;
    } finally {
      setSavingRepoLinks(false);
    }
  }, [configText, repoLinksConfig, messageApi, createId]);

  return {
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
    currentRepoLinkKey,
    setCurrentRepoLinkKey,
    pendingRepoLinkKey,
    setPendingRepoLinkKey,
    currentRepoLinksGroup,
    currentRepoLinksIndex,
    handleRepoLinksChange,
    handleRepoLinksUpdate,
    handleRepoLinkUpdate,
    handleRepoLinkRemove,
    handleRepoLinkAdd,
    handleQuickTagsChange,
    ensureRepoLinksForKey,
    handleSaveConfig,
    handleSaveRepoLinks,
  };
}
