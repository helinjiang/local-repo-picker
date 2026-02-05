# Web UI Step 3 Prompt：实现 `repo ui` 命令（启动服务 + 打开浏览器）

目标：让 `repo ui` 成为用户入口：启动本地服务、输出 URL、并尝试自动打开浏览器。

## 行为
- 若已有服务在运行（state.json 存在且 pid 存活）：
  - 直接打印 URL
  - 不重复启动
- 否则：
  - 启动 server（复用 Step 1 入口）
  - 写 state.json
  - 打印 URL
  - macOS：调用 `open <url>` 自动打开浏览器（execa + args）
- 支持参数：
  - `--port <n>` 指定端口（若占用则报错或自动找下一个，需说明）
  - `--no-open` 不自动打开浏览器
  - `--dev` 使用前端 dev server（可选）

## 输出要求
- CLI 代码改动
- 帮助文案更新（repo --help）
- 手工验证：
  - `repo ui`
  - 再次执行 `repo ui` 不会重复启动
