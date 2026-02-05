# Web UI Step 5 Prompt：集成打磨（性能/安全/稳定性）

目标：让 Web UI 版本达到“日常可用”的质量：性能稳定、安全合理、可调试。

## 要求
1. 性能
- /api/repos 支持分页（page/pageSize），默认 200
- /api/preview 增加 server-side 缓存（LRU Map），避免频繁 git 调用
- git 调用并发限制（p-limit）
2. 安全
- 仅监听 127.0.0.1
- CORS 仅允许 localhost
- 对 path 参数做校验：必须是绝对路径且在 scanRoots 下（防止任意文件读取）
3. 稳定性
- state.json 损坏要可恢复
- server 崩溃时 status 能提示
4. DX
- DEBUG=1 输出 server 启动端口、API 调用耗时（可选）
- 前端错误提示（Antd message/notification）

## 输出要求
- patch 或关键文件内容
- 验收 checklist（手工验证步骤）
