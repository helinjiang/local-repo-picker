import { useEffect, useState } from 'react';
import type { message } from 'antd';
import type { RepoPreviewResult } from '../types';
import { fetchPreview } from '../api';

export function usePreview(
  selectedPath: string | null,
  messageApi: ReturnType<typeof message.useMessage>[0],
) {
  const [preview, setPreview] = useState<RepoPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!selectedPath) {
        setPreview(null);

        return;
      }

      setLoadingPreview(true);

      try {
        const data = await fetchPreview(selectedPath);

        if (!cancelled) {
          setPreview(data);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`预览加载失败：${(error as Error).message}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedPath, messageApi]);

  return { preview, loadingPreview, setPreview };
}
