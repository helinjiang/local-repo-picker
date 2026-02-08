# AI Prompt：实现 local-repo-picker（TypeScript + Ink）

你是一个资深 **TypeScript / Node.js CLI 工程师**。  
请实现一个 npm 包 **`local-repo-picker`**，要求满足以下功能与工程质量标准。  
**请直接输出完整项目代码（包含所有文件内容），并确保可运行。**

---

## 🎯 目标

实现一个本地 Git 仓库选择器：

- 命令行运行 `repo` 启动一个 **Ink TUI**
- 左侧列表选择仓库
- 右侧实时预览（类似 fzf preview）
- 支持多个扫描根目录
- 支持缓存 / LRU / 手动 tag
- 既可作为 CLI 使用，也可被 `import` 引入

---

## ✅ 必须要求（硬性）

### 1️⃣ 使用 TypeScript

- 使用 TypeScript 实现
- 支持 Node.js **18+ / 20+**
- 构建输出到 `dist/`
- 支持：
  - CLI 正常运行
  - npm 包可被 `import`

### 2️⃣ 使用 Ink 作为 UI

- 使用 `ink` + `react`
- 左侧：仓库列表（支持模糊搜索）
- 右侧：选中仓库的 **实时预览**

### 3️⃣ 支持多个扫描根目录

配置项：

```ts
scanRoots: string[]
```

扫描规则：

- 最大深度：`maxDepth`（默认 `7`）
- 忽略目录：
  - `pruneDirs: string[]`（如 node_modules / dist / build 等）
  - basename 以 `.` 或 `_` 开头的目录（`.git` 例外）
- 仓库识别：
  - `.git` 是目录
  - `.git` 是文件（worktree / submodule）

### 4️⃣ npm 包可被 import 使用

```ts
import pickRepo from 'local-repo-picker';
const result = await pickRepo();
```

返回值类型至少包含：

```
type PickResult = {
  path: string;
  fullName: string;
  originUrl?: string;
  tags: string[];
};
```

### 5️⃣ 支持全局安装 + CLI

```bash
npm i -g local-repo-picker
repo
repo --config
repo refresh
```

配置与数据路径（推荐）
使用 env-paths 自动处理平台差异：

- config：
  • macOS: ~/Library/Application Support/local-repo-picker/config.json
- cache：
  • ~/Library/Caches/local-repo-picker/repos.json
- manual tags：
  • repo_tags.tsv
- LRU：
  • lru.txt

repo --config 行为：
• 若 config 不存在 → 创建模板
• 打印路径 + 提示“在此修改配置”

### 6️⃣ Ink 预览区（fzf-like）

预览内容：

- PATH
- ORIGIN
- BRANCH
- STATUS
- SYNC
- RECENT COMMITS（精确到秒）
- README（最多 200 行）

性能要求
• 预览 惰性计算（只在选中时）
• git 命令并发限制（推荐 p-limit, 4~8）
• 预览更新防抖（≈120ms）

## 🔖 Tag / Cache / LRU / UI / 工程 / 验收

（详见完整 Prompt 版本，要求全部实现）

---

> 本文档可直接作为 AI Coding Prompt 使用。
