import { useCallback, useState } from 'react';
import type { message } from 'antd';
import type { RepoItem } from '../types';
import { updateTags, upsertTags } from '../api';
import { stripTagBrackets } from '../utils/tagUtils';

export function useTags(params: {
  messageApi: ReturnType<typeof message.useMessage>[0];
  reloadRepos: () => Promise<void>;
}) {
  const { messageApi, reloadRepos } = params;
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalRepo, setTagModalRepo] = useState<RepoItem | null>(null);
  const [tagModalMode, setTagModalMode] = useState<'add' | 'edit'>('add');

  const handleAddTag = useCallback((repo: RepoItem) => {
    setTagModalRepo(repo);
    setTagModalMode('add');
    setTagModalOpen(true);
  }, []);

  const handleRemoveTag = useCallback(
    async (repo: RepoItem, removedTag: string) => {
      try {
        await updateTags(repo.folderFullPath, { remove: [removedTag] });
        messageApi.success('标签已删除');
        await reloadRepos();
      } catch (error) {
        messageApi.error(`删除标签失败：${(error as Error).message}`);
      }
    },
    [messageApi, reloadRepos],
  );

  const handleSaveTags = useCallback(
    async (nextTags: string) => {
      if (!tagModalRepo) {
        return;
      }

      try {
        if (tagModalMode === 'add') {
          const parsed = nextTags
            .split(/[\s,]+/)
            .map(stripTagBrackets)
            .filter(Boolean);

          if (parsed.length === 0) {
            setTagModalOpen(false);
            setTagModalRepo(null);

            return;
          }

          await updateTags(tagModalRepo.folderFullPath, { add: parsed });
          messageApi.success('标签已新增');
        } else {
          await upsertTags(tagModalRepo.folderFullPath, nextTags);
          messageApi.success('标签已更新');
        }

        setTagModalOpen(false);
        setTagModalRepo(null);
        await reloadRepos();
      } catch (error) {
        messageApi.error(`更新标签失败：${(error as Error).message}`);
      }
    },
    [tagModalRepo, tagModalMode, messageApi, reloadRepos],
  );

  return {
    tagModalOpen,
    tagModalRepo,
    tagModalMode,
    setTagModalOpen,
    handleAddTag,
    handleRemoveTag,
    handleSaveTags,
  };
}
