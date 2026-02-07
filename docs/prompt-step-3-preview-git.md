# Step 3 Prompt：Git 预览（fzf-like）

目标：在 Ink UI 中加入右侧 git 预览区。

## 预览内容

- PATH
- ORIGIN（解析 .git/config，兜底 git）
- BRANCH
- STATUS（dirty / clean）
- SYNC（ahead / behind）
- RECENT COMMITS（12 条，时间到秒）
- README（最多 200 行）

## 性能

- 仅在选中 repo 时计算
- 使用 p-limit 控制 git 并发
- 120ms debounce
- 结果缓存

## UI

- 右侧实时更新
- 加载中状态（Loading...）

## 输出

- useRepoPreview(repo) hook
- PreviewPanel 组件
