# Step 7 Prompt：Testing Strategy（测试策略）

目标：为 local-repo-picker 制定一套**可持续的测试策略**，
保证在未来重构 / 扩展时不引入回归。

---

## 🎯 本阶段关注点

- 测试分层（Test Pyramid）
- 可测试性（Testability）
- 回归保障（Regression Safety）

---

## 1️⃣ 测试分层设计

### 1.1 单元测试（Unit Tests）

**覆盖对象**

- path 扫描逻辑
- tag 推导（remote / auto / dirty）
- owner/repo 解析
- config 解析与默认值

**建议**

- 使用 vitest / jest
- mock fs（memfs / fs-extra）
- mock git（假命令返回）

---

### 1.2 集成测试（Integration Tests）

**覆盖对象**

- 扫描 + cache
- LRU 更新
- manual tag 读写

**策略**

- 在 temp dir 中创建假 repo：
  - `.git` 目录
  - `.git` 文件（worktree）
- 运行真实扫描逻辑

---

### 1.3 UI 测试（轻量）

**不要求全自动**

建议：

- 将 Ink UI 拆成纯逻辑组件
- 对 reducer / state logic 做测试
- UI 本身用人工回归测试

---

## 2️⃣ Git 相关测试策略

### 2.1 Mock 优先

- git 命令通过 adapter 层
- adapter 可注入 fake 实现

### 2.2 真 git 测试（少量）

- CI 环境中：
  - init repo
  - commit
  - 制造 dirty 状态
- 只覆盖最关键路径

---

## 3️⃣ 性能与压力测试（可选）

- 大量 fake repo（脚本生成）
- 统计：
  - 扫描耗时
  - cache 命中时间
- 作为 benchmark，不必进 CI

---

## 4️⃣ 回归测试清单（Checklist）

每次大改后人工确认：

- [ ] UI 可启动
- [ ] repo 列表完整
- [ ] 预览切换正常
- [ ] dirty 判断正确
- [ ] cache refresh 正常
- [ ] repo --config 正常

---

## 5️⃣ CI 建议（可选）

- Node 18 / 20 matrix
- steps：
  - install
  - typecheck
  - unit tests
- UI 不必在 CI 中跑

---

## 6️⃣ 验收标准

1. 核心逻辑有单元测试覆盖
2. 扫描 / tag / config 可被独立测试
3. 新增功能不会轻易破坏旧逻辑
4. 项目具备长期维护信心

---

> 本阶段完成后，local-repo-picker 将具备：
> **“可持续演进而不崩”的工程保障能力。**
