# Step 1 Prompt：Repo 扫描 & Cache（TypeScript）

目标：实现 local-repo-picker 的 **扫描 / cache / tag / LRU 核心能力**，不涉及 UI。

## 要求

- 使用 TypeScript
- Node 18+
- 可作为库被 import
- 不使用 Ink / UI

## 功能

1. 多 scanRoots 扫描 git 仓库
2. maxDepth（默认 7）
3. 忽略：
   - pruneDirs
   - 目录名以 . 或 \_ 开头（.git 例外）
4. 正确识别：
   - .git 目录
   - .git 文件（worktree）
5. 不进入 .git 内部

## Cache

- JSON cache
- TTL 默认 12h
- refresh API

## Tags

- auto tag（一级目录）
- remote tag（github / gitee / internal）
- dirty tag（git status --porcelain）
- manual tag（repo_tags.tsv）

## LRU

- 最近使用 repo 置顶
- 最大 300 条

## 输出

- RepoInfo[] 数据结构
- buildCache(), loadCache(), refreshCache() API
