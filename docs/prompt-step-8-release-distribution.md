# Step 8 Prompt：Release & Distribution（发布与分发）

目标：让 **local-repo-picker** 具备**规范发布、可持续升级、对用户友好的分发能力**，
从“本地自用工具”升级为“可公开发布的成熟 npm 包”。

---

## 🎯 本阶段关注点

- npm 发布规范
- 版本管理（SemVer）
- 变更记录（Changelog）
- 升级与兼容性策略
- 用户分发体验

---

## 1️⃣ npm 包发布规范

### 1.1 package.json 校验

确保包含以下关键字段：

- `name: "local-repo-picker"`
- `version`
- `description`
- `keywords`
- `license`
- `repository`
- `homepage`
- `bugs`

### 1.2 bin 与 exports

- `bin`：
  ```json
  {
    "repo": "./dist/cli.js"
  }
  ```
- `exports`：
  ```json
  {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
  ```

> 若只支持 ESM，可明确写在 README 中。

---

## 2️⃣ 版本管理策略（SemVer）

### 2.1 版本号含义

- `MAJOR`：破坏性变更（CLI 行为 / Config 结构）
- `MINOR`：新增功能（向后兼容）
- `PATCH`：Bug 修复 / 性能优化

### 2.2 推荐流程

- 开发阶段：`0.x`
- 稳定发布：`1.0.0`
- 每次发布前：
  - 更新 version
  - 更新 CHANGELOG

---

## 3️⃣ Changelog 规范

### 3.1 文件

- `CHANGELOG.md`

### 3.2 格式（推荐）

```md
## [1.2.0] - 2026-02-04

### Added

- New git preview panel

### Fixed

- Crash when repo has no upstream

### Changed

- Cache TTL default to 12h
```

### 3.3 原则

- 面向用户描述
- 不写内部重构细节
- 每个版本都要写

---

## 4️⃣ 发布流程（推荐）

### 4.1 本地发布前检查

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`（如有）
- 手动跑：
  ```bash
  npm i -g .
  repo
  ```

### 4.2 npm 发布

```bash
npm login
npm publish
```

如为 scoped 包：

```bash
npm publish --access public
```

---

## 5️⃣ 升级与兼容性策略

### 5.1 Config 兼容

- Config 结构变更：
  - 提供 migration
  - 或自动 fallback 默认值
- 启动时检测 config 版本（可选）

### 5.2 Cache 兼容

- cache schema 变更：
  - 自动 rebuild
  - 不尝试兼容旧 cache

---

## 6️⃣ 用户体验（Distribution UX）

### 6.1 安装说明

README 中清晰说明：

```bash
npm i -g local-repo-picker
```

### 6.2 初次运行体验

- 第一次运行：
  - 自动生成 config
  - 提示如何修改
- 错误提示清晰（不要堆栈）

---

## 7️⃣ 发布后维护

### 7.1 Issue 模板（可选）

- Bug Report
- Feature Request

### 7.2 Roadmap（可选）

- README 中列出未来方向：
  - Action system
  - Plugin system
  - Windows 支持增强

---

## 8️⃣ 验收标准（Release）

1. npm 上可成功安装
2. 全局命令 `repo` 可用
3. README 指南完整
4. 升级不会破坏现有用户配置
5. 版本变更可追溯（CHANGELOG）

---

> 本阶段完成后，local-repo-picker 将具备：
> **“可以放心发布、有人用也不慌”的发布与分发能力。**
