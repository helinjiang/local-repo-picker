# Refactor Step 3 Prompt：实现 fzf picker（替换默认 UI）

目标：将 `repo` 默认交互从 Ink 切换为 fzf，使用 Step1/2 的 internal 子命令实现列表与预览。

## 行为
- 启动 fzf：
  - 输入：`repo __list --all`
  - delimiter TSV：\t
  - with-nth=1（只显示 display）
  - preview：`repo __preview --path {2}`
- 快捷键过滤（配置驱动）：
  - 从 config 读取 `fzfTagFilters`（key:tag）
  - 自动生成 `--bind key:reload(repo __list --filter-tag <tag>)`
  - ctrl-a: reload(all)
- 选择 Enter：
  - 返回选中 repo（abs path）
  - 更新 LRU（复用现有逻辑）
- 未安装 fzf：
  - 友好提示 + 非 0 退出码

## 输出要求
- patch 或完整文件内容
- README 增补：依赖 fzf、快捷键
