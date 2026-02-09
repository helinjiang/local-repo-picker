import { useCallback, useState } from 'react';
import type { message } from 'antd';
import type { ListItem } from '../types';
import { updateTags, upsertTags } from '../api';
import { normalizeTagValue } from '../utils/tagUtils';

export function useTags(params: {
  messageApi: ReturnType<typeof message.useMessage>[0];
  reloadRepos: () => Promise<void>;
  reloadTagOptions: () => Promise<void>;
}) {
  const { messageApi, reloadRepos, reloadTagOptions } = params;
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalRepo, setTagModalRepo] = useState<ListItem | null>(null);
  const [tagModalMode, setTagModalMode] = useState<'add' | 'edit'>('add');
  const [tagRenameOpen, setTagRenameOpen] = useState(false);
  const [tagRenameRepo, setTagRenameRepo] = useState<ListItem | null>(null);
  const [tagRenameValue, setTagRenameValue] = useState<string | null>(null);
  const [tagRenameSaving, setTagRenameSaving] = useState(false);

  const handleAddTag = useCallback((repo: ListItem) => {
    setTagModalRepo(repo);
    setTagModalMode('add');
    setTagModalOpen(true);
  }, []);

  const handleRemoveTag = useCallback(
    async (repo: ListItem, removedTag: string) => {
      try {
        await updateTags(repo.record.fullPath, { remove: [removedTag] });
        messageApi.success('标签已删除');
        await reloadRepos();
        await reloadTagOptions();
      } catch (error) {
        messageApi.error(`删除标签失败：${(error as Error).message}`);
      }
    },
    [messageApi, reloadRepos, reloadTagOptions],
  );

  const handleRenameTag = useCallback((repo: ListItem, tag: string) => {
    setTagRenameRepo(repo);
    setTagRenameValue(tag);
    setTagRenameOpen(true);
  }, []);

  const handleSaveTagRename = useCallback(
    async (nextTag: string) => {
      if (!tagRenameRepo || !tagRenameValue) {
        return;
      }

      const normalizedNext = normalizeTagValue(nextTag);

      if (!normalizedNext || normalizedNext === tagRenameValue) {
        setTagRenameOpen(false);
        setTagRenameRepo(null);
        setTagRenameValue(null);

        return;
      }

      try {
        setTagRenameSaving(true);
        const existing = new Set([
          ...tagRenameRepo.record.autoTags,
          ...tagRenameRepo.record.manualTags,
        ]);
        const add = existing.has(normalizedNext) ? [] : [normalizedNext];
        await updateTags(tagRenameRepo.record.fullPath, {
          remove: [tagRenameValue],
          add,
        });
        messageApi.success('标签已重命名');
        setTagRenameOpen(false);
        setTagRenameRepo(null);
        setTagRenameValue(null);
        await reloadRepos();
        await reloadTagOptions();
      } catch (error) {
        messageApi.error(`重命名标签失败：${(error as Error).message}`);
      } finally {
        setTagRenameSaving(false);
      }
    },
    [tagRenameRepo, tagRenameValue, messageApi, reloadRepos, reloadTagOptions],
  );

  const handleSaveTags = useCallback(
    async (nextTags: string[]) => {
      if (!tagModalRepo) {
        return;
      }

      try {
        if (tagModalMode === 'add') {
          const parsed = Array.from(
            new Set(nextTags.map((tag) => normalizeTagValue(tag)).filter(Boolean)),
          );

          if (parsed.length === 0) {
            setTagModalOpen(false);
            setTagModalRepo(null);

            return;
          }

          await updateTags(tagModalRepo.record.fullPath, { add: parsed });
          messageApi.success('标签已新增');
        } else {
          const parsed = normalizeTagValue(nextTags[0] ?? '');

          if (!parsed) {
            setTagModalOpen(false);
            setTagModalRepo(null);

            return;
          }

          await upsertTags(tagModalRepo.record.fullPath, parsed);
          messageApi.success('标签已更新');
        }

        setTagModalOpen(false);
        setTagModalRepo(null);
        await reloadRepos();
        await reloadTagOptions();
      } catch (error) {
        messageApi.error(`更新标签失败：${(error as Error).message}`);
      }
    },
    [tagModalRepo, tagModalMode, messageApi, reloadRepos, reloadTagOptions],
  );

  return {
    tagModalOpen,
    tagModalRepo,
    tagModalMode,
    setTagModalOpen,
    tagRenameOpen,
    tagRenameRepo,
    tagRenameValue,
    tagRenameSaving,
    setTagRenameOpen,
    handleAddTag,
    handleRemoveTag,
    handleRenameTag,
    handleSaveTagRename,
    handleSaveTags,
  };
}
