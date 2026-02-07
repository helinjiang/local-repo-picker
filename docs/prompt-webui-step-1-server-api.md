# Web UI Step 1 Prompt：实现本地 Web Server + API（复用 core 逻辑）

目标：新增 `repo ui` 的服务端，实现 REST API，Web UI 后续通过这些 API 驱动。

## 技术要求

- TypeScript
- 服务器框架：Fastify（推荐）或 Express（二选一）
- 禁止 `shell: true`，外部命令使用 execa args 数组
- 复用现有 core：scan/cache/tags/lru/git/preview/actions/config/env-paths
- 支持 CORS（仅 localhost），并加基础安全头（可用 helmet）

## 功能

1. 启动服务
   - 默认端口 17333；若占用则自动递增找到空闲端口
   - 仅监听 127.0.0.1
2. API 端点（最小可用）
   - `GET /api/status` -> { url, port, pid, startedAt, cacheFresh, repoCount }
   - `GET /api/repos` -> 支持 query：
     - q= 模糊搜索
     - tag= 单个 tag 过滤
     - sort=lru|name
       返回：RepoInfo[]（包含 path, ownerRepo, originUrl, tags, isDirty(可选)）
   - `GET /api/preview?path=<abs>` -> RepoPreview（与 fzf/ink 预览一致：commits 时间到秒）
   - `POST /api/action` body: { actionId, path } -> 执行 action
   - `POST /api/cache/refresh` -> 强制 rebuild cache
   - `POST /api/tags` body: { path, tags } -> 写入 manual tags（repo_tags.tsv），并可选 refresh cache
3. 状态文件
   - 服务启动后写入 state.json：{ pid, port, url, startedAt }
   - 路径使用 env-paths（data 或 cache）
4. 优雅退出（SIGINT/SIGTERM）
   - 清理 state.json（或标记 stopped）

## 输出要求

- 代码改动（patch 或完整文件）
- 最小手工验证命令：
  - `repo ui`
  - `curl localhost:<port>/api/status`
  - `curl /api/repos`
