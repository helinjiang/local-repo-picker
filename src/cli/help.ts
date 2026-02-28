import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function printHelp(): void {
  const lines = [
    'Usage: repo [command] [options]',
    '',
    'Commands:',
    '  refresh            强制重建 cache',
    '  list               输出 repo 列表（支持过滤/排序/格式）',
    '  one                在当前 git 仓库中选择 action',
    '  ui                 启动本地 Web UI',
    '  ui stop            停止 Web UI',
    '  ui restart         重启 Web UI',
    '  status             查看 Web UI 状态',
    '',
    'Options:',
    '  --port <n>         指定 Web UI 端口（若占用会自动递增）',
    '  --no-open          不自动打开浏览器',
    '  --dev              使用前端 dev server',
    '  --config           创建默认配置并输出路径',
    '  --json             输出 JSON（用于 repo list/status）',
    '  --output-webui-url 仅输出 Web UI 地址（用于 repo status）',
    '  --tsv              输出 TSV（用于 repo list）',
    '  --q <text>         关键词过滤（用于 repo list）',
    '  --tag <tag>        tag 过滤（用于 repo list）',
    '  --dirty            仅输出 dirty 仓库（用于 repo list）',
    '  --sort lru|name    排序方式（用于 repo list）',
    '  --list             输出 repo 列表（兼容旧参数）',
    '  -h, --help         显示帮助',
    '  -v, --version      显示版本号',
  ];
  console.log(lines.join('\n'));
}

export async function readPackageVersion(): Promise<string> {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(cliDir, '..', 'package.json'),
    path.resolve(cliDir, '..', '..', 'package.json'),
  ];

  for (const packageFile of candidates) {
    try {
      const content = await fs.readFile(packageFile, 'utf8');
      const data = JSON.parse(content) as { version?: string };

      if (typeof data.version === 'string') {
        return data.version;
      }
    } catch {
      // ignore
    }
  }

  return '';
}
