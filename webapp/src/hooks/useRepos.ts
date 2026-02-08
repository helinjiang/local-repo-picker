import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { message } from 'antd';
import type { ListItem } from '../types';
import { fetchRepos, refreshCache } from '../api';

export function useRepos(params: {
  debouncedQuery: string;
  tag?: string;
  messageApi: ReturnType<typeof message.useMessage>[0];
}) {
  const { debouncedQuery, tag, messageApi } = params;
  const [repos, setRepos] = useState<ListItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);

  const loadRepos = useCallback(
    async (options?: { page?: number; pageSize?: number }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const targetPage = options?.page ?? page;
      const targetPageSize = options?.pageSize ?? pageSize;
      setLoadingRepos(true);

      try {
        const data = await fetchRepos({
          q: debouncedQuery,
          tag,
          page: targetPage,
          pageSize: targetPageSize,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        if (data.items.length === 0 && targetPage > 1) {
          setPage(1);

          return;
        }

        setRepos(data.items);
        setTotal(data.total);
        setPage(data.page);
        setPageSize(data.pageSize);

        if (!data.items.find((repo) => repo.record.fullPath === selectedPath)) {
          setSelectedPath(data.items[0]?.record.fullPath ?? null);
        }
      } catch (error) {
        if (requestIdRef.current === requestId) {
          messageApi.error(`获取仓库列表失败：${(error as Error).message}`);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoadingRepos(false);
        }
      }
    },
    [debouncedQuery, tag, page, pageSize, selectedPath, messageApi],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, tag]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const reloadRepos = useCallback(async () => {
    await loadRepos();
  }, [loadRepos]);

  const handleRefreshCache = useCallback(async () => {
    if (refreshingCache) {
      return;
    }

    setRefreshingCache(true);

    try {
      await refreshCache();
      messageApi.success('缓存已刷新');
      await loadRepos();
    } catch (error) {
      messageApi.error(`刷新缓存失败：${(error as Error).message}`);
    } finally {
      setRefreshingCache(false);
    }
  }, [refreshingCache, messageApi, loadRepos]);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.record.fullPath === selectedPath) ?? null,
    [repos, selectedPath],
  );

  return {
    repos,
    setRepos,
    selectedPath,
    setSelectedPath,
    selectedRepo,
    loadingRepos,
    refreshingCache,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    setTotal,
    reloadRepos,
    handleRefreshCache,
  };
}
