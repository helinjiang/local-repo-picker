# Refactor Step 4 Prompt：actions 选择与兼容（二次 fzf）

目标：选择 repo 后，弹出 action 列表（fzf），并执行对应 action（复用现有 actions 模块）。

## 行为

- actions 列表来源：
  - 复用现有 Action 定义（若没有，先抽象出来）
- 选择 action 后执行：
  - open in VSCode
  - open in iTerm
  - open in Finder
  - add tag（打开 tags 文件并定位；刷新 cache）
  - refresh cache
- 确保 library API `pickRepo()` 仍能返回 PickResult，不强制执行 action
  - CLI 路径执行 action
  - library 仅返回结果（或提供可选参数决定是否启用 actions）

## 输出要求

- patch 或完整文件内容
- 手工验证步骤
