# Step 5 Prompt：Polish & DX（性能 / 体验 / 可维护性）

目标：在 local-repo-picker 已具备完整功能（扫描 / UI / 预览 / CLI）的基础上，
进行**工程级打磨**，使其达到“长期自用 + 可开源维护”的质量水平。

---

## 🎯 本阶段关注点

- 性能（Performance）
- 体验（User Experience）
- 可维护性（Maintainability）
- 可调试性（Debuggability）
- 扩展性（Extensibility）

本阶段**不引入新核心功能**，只优化现有能力。

---

## 1️⃣ 性能优化（Performance）

### 1.1 扫描性能

- 确保目录遍历：
  - 使用 BFS / 受控 DFS
  - 严格限制 maxDepth
  - `.git` 目录只用于识别，不深入
- 扫描阶段提供：
  - 扫描耗时统计
  - repo 数量统计

### 1.2 Git 调用优化

- 所有 git 命令统一封装在 `git.ts`
- 使用 `p-limit` 控制并发（默认 4～8）
- Preview 阶段：
  - 选中 repo 才触发 git 命令
  - 结果缓存（LRU 或 Map）
  - debounce（≈120ms）

### 1.3 Cache 策略

- cache 命中时：
  - 不重新扫描
  - 仅在 UI 中展示
- cache rebuild：
  - 显示“Rebuilding cache...”状态
  - 统计耗时并写入 cache metadata

---

## 2️⃣ 体验优化（UX）

### 2.1 UI 反馈

- 顶部状态栏：
  - 扫描中 / 使用 cache
  - repo 总数
  - 当前 filter
- 右侧预览：
  - loading 状态（spinner 或文本）
  - 错误状态（git 不可用等）

### 2.2 键位与提示

- 明确显示快捷键说明（底部）
- Esc / q 行为一致
- 搜索框 focus 状态明显

### 2.3 容错体验

- git 命令失败：
  - 不崩溃
  - 预览区显示友好提示
- repo 被删除 / 移动：
  - 自动从 cache 中剔除
  - 下次 refresh 修复

---

## 3️⃣ 可维护性（Maintainability）

### 3.1 代码结构

- 分层清晰：
  - core/（纯逻辑）
  - ui/（Ink 组件）
  - git/（git 封装）
  - config/
- 避免“巨型文件”
- 单文件职责明确

### 3.2 类型设计

- 核心类型集中在 `types.ts`
- 明确区分：
  - RepoInfo（扫描结果）
  - RepoPreview（预览数据）
  - Config
- 避免 `any`

### 3.3 错误边界

- UI 层使用 Error Boundary（如 Ink 支持）
- CLI 层捕获未处理异常，输出友好错误

---

## 4️⃣ 可调试性（DX / Debug）

### 4.1 Debug 模式

- 支持：
  ```bash
  DEBUG=1 repo
  ```
- Debug 输出内容：
  - 使用 cache / rebuild cache
  - 扫描阶段进度
  - git 命令耗时（可选）

### 4.2 日志规范

- 使用统一 logger（debug/info/warn）
- 默认安静，DEBUG 才输出详细信息

---

## 5️⃣ 扩展性（Extensibility）

### 5.1 Action 系统预留

- 抽象：
  ```ts
  type Action = {
    id: string;
    label: string;
    run(repo: RepoInfo): Promise<void>;
  };
  ```
- 内置 action：
  - open in VSCode
  - open in iTerm
- UI 支持未来扩展 action picker

### 5.2 Tag 扩展

- tag 生成逻辑模块化
- 允许未来添加：
  - [ahead]
  - [behind]
  - [detached]
  - 自定义规则 tag

---

## 6️⃣ README & 文档

### README 必须包含

- 项目动机
- 功能截图（可选）
- 安装方式
- CLI 使用
- Config 示例（完整）
- Cache / Tag / LRU 说明
- FAQ（性能、git 依赖等）

---

## 7️⃣ 验收标准（Polish 阶段）

1. 大 workspace（1000+ repo）启动时间可接受
2. 快速上下移动 selection 时 UI 流畅
3. 无未处理 Promise rejection
4. TypeScript strict 模式通过
5. DEBUG 模式信息完整但不污染默认输出
6. README 可指导新用户上手

---

> 本阶段完成后，local-repo-picker 应达到：
> **“可以长期自用，也可以开源给别人用”的质量水平。**
