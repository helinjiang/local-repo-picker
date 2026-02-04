# Refactor Step 2 Prompt：新增 internal 子命令 `repo __preview --path <abs>`（复用 preview builder）

目标：新增 `repo __preview --path <abs>`，用于 fzf 的 `--preview` 调用。

## 行为
- 输入：--path <absolute path>
- 输出：纯文本（可带 ANSI），包含：
  - PATH
  - ORIGIN
  - BRANCH
  - STATUS（dirty/clean）
  - SYNC（ahead/behind，如无 upstream 则不显示）
  - RECENT COMMITS（12 条，时间精确到秒）
  - README（≤200 行）
- 必须复用现有 git/preview 模块（并发限制、debounce 在这里可简化为缓存 + 超时）
- 必须有超时保护：单个 repo preview 构建超过 2s 时输出降级信息（例如“preview timed out”）

## 安全
- 不使用 shell=true
- 参数必须校验为绝对路径

## 输出要求
- patch 或完整文件内容
- 手工验证命令
