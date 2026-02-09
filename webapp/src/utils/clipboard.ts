import type { message } from 'antd';

export async function copyPathToClipboard(
  path: string,
  messageApi: ReturnType<typeof message.useMessage>[0],
): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard unavailable');
    }

    await navigator.clipboard.writeText(path);
    messageApi.success('路径已复制');
  } catch (error) {
    messageApi.error(`复制失败：${(error as Error).message}`);
  }
}
