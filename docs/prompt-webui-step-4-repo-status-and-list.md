# Web UI Step 4 Prompt：实现 `repo status` 与 `repo list`（并把 `repo` 默认改为 help）

目标：完成 CLI 重构：
- `repo` 默认等效 `repo --help`
- 旧的 repo 主逻辑迁移到 `repo list`
- 新增 `repo status` 输出 UI URL

## repo status 行为
- 读取 state.json
- 校验 pid 存活（macOS 可用 process.kill(pid, 0)）
- 若存活：打印 URL（仅输出 URL 一行，便于复制）
- 若不存活：提示“UI not running, run `repo ui`”
- 可选：`--json` 输出结构化信息

## repo list 行为
- 输出仓库列表（默认人类可读；提供 `--json` 和 `--tsv`）
- 支持过滤：
  - `--q <text>`
  - `--tag <tag>`
  - `--dirty`
  - `--sort lru|name`
- 复用 cache 与 tags 逻辑，不重新 scan

## 输出要求
- CLI 更新 patch
- README 更新（新命令体系）
- 手工验证命令集合
