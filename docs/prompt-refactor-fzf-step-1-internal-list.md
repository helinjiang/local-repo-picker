# Refactor Step 1 Prompt：新增 internal 子命令 `repo __list`（走 cache 输出 TSV）

目标：新增 `repo __list`，用于给 fzf 提供列表输入，避免在 fzf bind 中写 awk/sed。

## 行为

- 命令：`repo __list --all`
  - 输出 TSV（三列）：
    1. display（owner/repo + ANSI tags）
    2. absPath
    3. rawTags（用于过滤）
- 命令：`repo __list --filter-tag <tag>`
  - 仅输出 rawTags 字段包含该 tag 的行（精确包含即可）
- 数据来源必须走现有 cache（若 cache 过期，调用现有 refresh/rebuild）
- 不允许重新实现 scan/cache/tags，只能复用现有模块

## 输出要求

- 仅修改/新增必要文件
- 给出 patch 或完整文件内容
- 添加最小测试或手工验证步骤（命令示例）
