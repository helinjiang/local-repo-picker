import { useEffect, useState } from 'react';
import type { message } from 'antd';
import type { ActionInfo } from '../types';
import { fetchActions } from '../api';

export function useActions(messageApi: ReturnType<typeof message.useMessage>[0]) {
  const [actions, setActions] = useState<ActionInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadActions() {
      try {
        const data = await fetchActions();

        if (!cancelled) {
          setActions(data);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(`获取 Actions 失败：${(error as Error).message}`);
        }
      }
    }

    void loadActions();

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  return { actions };
}
