# Master Prompt：local-repo-picker（Step 0–12 全量版）

> 本文档是 **local-repo-picker** 的「**终极 AI Coding Prompt**」，  
> 覆盖从 **工程初始化 → 功能实现 → 打磨 → 发布 → 安全 → 扩展 → 文档** 的完整生命周期。
>
> **推荐用法**：
>
> - 不要一次性生成全部代码
> - 按 Checklist 分阶段喂给 AI（Step by Step）
> - 每一步都可独立完成、验证、回滚

---

## 🎯 项目目标

实现一个本地 Git 仓库选择器：

- npm 包名：`local-repo-picker`
- CLI 命令：`repo`
- 技术栈：
  - TypeScript
  - Ink（TUI）
  - Node.js 18+
- 核心能力：
  - 多 root Git 仓库扫描
  - 左侧列表 + 右侧预览（fzf-like）
  - Cache / Tag / LRU
  - 可 import 作为库使用
  - 可全局安装作为 CLI 使用

---

## 🧩 Step 总览（0–12）

| Step | 主题                      |
| ---- | ------------------------- |
| 0    | 工程骨架                  |
| 1    | 扫描 / Cache / Tag / LRU  |
| 2    | Ink UI（列表 + 搜索）     |
| 3    | Git 预览（fzf-like）      |
| 4    | CLI & Config              |
| 5    | Polish & DX               |
| 6    | Stability & Edge Cases    |
| 7    | Testing Strategy          |
| 8    | Release & Distribution    |
| 9    | Security & Trust          |
| 10   | Plugin / Extension System |
| 11   | Cross-platform            |
| 12   | Docs & Demo               |

---

## 🧱 Step 0：工程骨架（Bootstrap）

### 目标

- TypeScript 工程可 build
- CLI `repo` 可运行
- npm 包可被 import

### Checklist

- [ ] package.json（name / bin / exports）
- [ ] tsconfig.json
- [ ] src/index.ts（export default）
- [ ] src/cli.ts（bin: repo）
- [ ] build 脚本可运行
- [ ] npm i -g . 后 repo 可执行

---

## 🔍 Step 1：扫描 / Cache / Tag / LRU

### 功能

- 多 scanRoots
- maxDepth（默认 7）
- pruneDirs
- `.git` 目录 / 文件识别
- Cache（TTL 12h）
- LRU（最近 300）

### Checklist

- [ ] 正确扫描 repo
- [ ] 不进入 `.git` 内部
- [ ] 自动 tag / remote tag / dirty tag
- [ ] manual tag（repo_tags.tsv）
- [ ] cache 可 rebuild
- [ ] LRU 排序生效

---

## 🎛 Step 2：Ink UI（列表 + 搜索）

### 功能

- 左侧 repo 列表
- 模糊搜索
- 键盘交互

### Checklist

- [ ] ↑ ↓ 移动
- [ ] Enter 确认
- [ ] Esc / q 退出
- [ ] 搜索过滤
- [ ] UI 不阻塞

---

## 🔎 Step 3：Git 预览（fzf-like）

### 预览内容

- PATH
- ORIGIN
- BRANCH
- STATUS（dirty / clean）
- SYNC（ahead / behind）
- RECENT COMMITS（12，精确到秒）
- README（≤200 行）

### Checklist

- [ ] 选中时才计算
- [ ] debounce（≈120ms）
- [ ] 并发限制
- [ ] loading / error 状态

---

## ⚙️ Step 4：CLI & Config

### 功能

- repo
- repo --config
- repo refresh

### Checklist

- [ ] env-paths
- [ ] 自动创建 config
- [ ] cache / tags / lru 路径正确
- [ ] CLI 行为与 README 一致

---

## ✨ Step 5：Polish & DX

### Checklist

- [ ] 性能可接受（1000+ repo）
- [ ] DEBUG=1 输出合理
- [ ] UI 反馈清晰
- [ ] 代码分层清楚

---

## 🛡 Step 6：Stability & Edge Cases

### Checklist

- [ ] git 不存在不崩溃
- [ ] repo 损坏不影响整体
- [ ] cache 损坏可自动恢复
- [ ] 快速切换 preview 不错乱

---

## 🧪 Step 7：Testing Strategy

### Checklist

- [ ] 单元测试（scan / tag / config）
- [ ] 集成测试（cache / LRU）
- [ ] git / fs mock
- [ ] 回归 checklist

---

## 🚀 Step 8：Release & Distribution

### Checklist

- [ ] npm publish 成功
- [ ] SemVer 管理
- [ ] CHANGELOG.md
- [ ] 升级不破坏用户配置

---

## 🔐 Step 9：Security & Trust

### Checklist

- [ ] 无 shell 注入
- [ ] 所有命令受控
- [ ] 路径安全
- [ ] README 描述 threat model

---

## 🔌 Step 10：Plugin / Extension System

### Checklist

- [ ] Action 插件接口
- [ ] Tag 插件接口
- [ ] 插件失败不影响主流程

---

## 🪟 Step 11：Cross-platform

### Checklist

- [ ] macOS / Linux 可用
- [ ] Windows / WSL 兼容
- [ ] 路径处理正确

---

## 📖 Step 12：Docs & Demo

### Checklist

- [ ] README 完整
- [ ] 使用示例
- [ ] FAQ
- [ ] Demo（GIF / asciinema）

---

## 🧠 使用建议（非常重要）

- 不要一次性生成全部代码
- 每个 Step 单独喂给 AI
- 每步完成后：
  - 本地运行
  - 手工验证
  - 再进入下一步

---

> **完成 Step 0–12 后，你将拥有一个：**
>
> - 可以长期自用
> - 可以放心开源
> - 可以持续演进
>
> 的专业级 CLI 工具。
