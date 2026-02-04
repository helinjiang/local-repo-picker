# Refactor Step 0 Prompt：评估与改造计划（Ink -> fzf）

目标：在不改动核心逻辑（scan/cache/tags/git/preview/actions/config）的前提下，制定将交互层从 Ink 替换为 fzf 的改造方案。

## 要求输出
1. 当前项目文件结构（按模块归类）
2. 交互层与核心层边界（哪些文件属于 UI，哪些属于 core）
3. 最小改造路径（按 Step 1~4 拆分）
4. 需要新增的 internal 子命令清单：
   - `repo __list`
   - `repo __preview`
   - `repo __actions`（可选）
5. 风险点与回滚策略

## 约束
- 不写任何代码，只输出计划与文件改动清单
