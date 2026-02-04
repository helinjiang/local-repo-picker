# Web UI Step 0 Prompt：CLI 规格与改造计划（repo -> repo list / repo ui / repo status）

你是资深 Node/TS CLI 工程师。现有 local-repo-picker 已实现扫描/cache/tag/LRU/git-preview/actions 等核心能力（交互是 fzf）。现在要新增 **Web UI** 并重构 CLI 命令体系。

## 目标（只输出计划，不写代码）
1. 重新定义 CLI 命令：
   - `repo` 默认行为等效 `repo --help`
   - `repo list`：输出仓库列表（文本/TSV/JSON，需说明默认格式与参数）
   - `repo ui`：启动本地 Web UI（默认端口策略、自动选择空闲端口）
   - `repo status`：输出当前 UI 服务的 URL（若未运行，给提示）
2. Web UI 需求：
   - 浏览器可视化操作
   - 组件库：Ant Design
   - 需要搜索、筛选 tag、查看 preview、执行 actions（至少 VSCode/iTerm/Finder/add tag/refresh cache）
3. 服务端架构选型：
   - Express/Fastify/koa（任选其一并说明理由）
   - 与现有 core 逻辑解耦，避免重写 scan/cache/git 模块
4. 状态持久化：
   - UI 端口/进程信息写入 state 文件（env-paths 的 data 或 cache 目录）
   - `repo status` 从该文件读取并校验进程仍存活
5. 风险与回滚策略：保留旧交互入口（可选），或以 feature flag 控制。

## 输出要求
- 计划文档：文件改动清单（新增哪些文件/目录、修改哪些文件）
- CLI help 文案草稿
- API 端点草图（/api/repos, /api/preview, /api/action, /api/tags, /api/cache/refresh, /api/status 等）
- 不写任何代码
