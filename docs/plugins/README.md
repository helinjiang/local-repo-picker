# 插件系统说明

本项目提供插件系统，支持扩展三类能力：Action、Tag、Preview。插件必须显式注册，失败不影响主流程。

## 术语与结构

- PluginModule：一个插件模块，可包含 actions / tags / previews
- Action：面向仓库的执行动作（可限制作用域）
- TagPlugin：为仓库追加标签
- PreviewPlugin：为预览区追加扩展块

相关类型定义位于 src/core/types.ts，插件注册逻辑位于 src/core/plugins.ts。

## Action 作用域

Action 可通过 scopes 限制使用场景：

- scopes: ["cli"] 仅在 CLI action picker 中可用
- scopes: ["web"] 仅在 Web UI Actions 中可用
- 不设置 scopes 默认两端都可用

## 内置插件如何新增

内置插件统一维护在 src/plugins/built-in.ts 中，并通过 registerBuiltInPlugins 注册。

新增步骤：

1. 在 src/plugins/built-in.ts 中新增 Action / TagPlugin / PreviewPlugin
2. 将它们加入 builtInPlugins 数组里的某个 PluginModule
3. 确保 registerBuiltInPlugins 能注册到你的模块

示例（新增一个内置 Action）：

```ts
import type { Action } from '../core/types';

const helloAction: Action = {
  id: 'builtin.hello',
  label: 'Say Hello',
  run: async (repo) => {
    console.log(`Hello ${repo.git?.fullName ?? repo.relativePath}`);
  },
};
```

将其挂入 builtInPlugins：

```ts
export const builtInPlugins: PluginModule[] = [
  {
    id: 'builtin.node',
    label: 'Node 插件',
    tags: [nodeTagPlugin],
    previews: [nodePreviewPlugin],
    actions: [pathActionPlugin, helloAction],
  },
];
```

内置插件在 CLI 与 Web UI 启动时都会被注册：

- CLI：src/cli.ts 在 fzf action picker 中调用 registerBuiltInPlugins
- Web UI：src/web/routes.ts 在 registerRoutes 内调用 registerBuiltInPlugins

## 使用者如何扩展插件

使用者可以在自己的 Node 脚本中引入并注册插件模块。推荐流程：

1. 引入 registerBuiltInPlugins 以保留内置插件
2. 注册自定义插件（registerPlugins 或 registerPlugin）
3. 在自己的运行入口中执行注册逻辑

示例（与 README 中示例一致）：

```ts
import { registerPlugins, registerBuiltInPlugins, type PluginModule } from 'local-repo-picker';

registerBuiltInPlugins();

const myPlugin: PluginModule = {
  id: 'acme.demo',
  label: 'Demo',
  actions: [
    {
      id: 'print-path',
      label: '打印路径',
      scopes: ['cli'],
      run: async (repo) => {
        console.log(repo.path);
      },
    },
  ],
  tags: [
    {
      id: 'custom-tag',
      label: '自定义标签',
      apply: async ({ repoPath }) => {
        return repoPath.includes('demo') ? ['[demo]'] : [];
      },
    },
  ],
  previews: [
    {
      id: 'custom-preview',
      label: '预览扩展',
      render: async ({ repo }) => {
        return { title: 'EXTRA', lines: [repo.git?.fullName ?? repo.relativePath] };
      },
    },
  ],
};

registerPlugins([myPlugin]);
```

如果你的插件是动态加载的，可使用 loadPlugins：

```ts
import { loadPlugins } from 'local-repo-picker';

await loadPlugins([async () => (await import('./my-plugin')).default]);
```

## 运行与安全约束

- 插件执行失败会被捕获并记录警告，不会阻断主流程
- TagPlugin 返回值会自动归一化为 [tag] 结构
- PreviewPlugin 返回的 section 会追加到预览扩展区
