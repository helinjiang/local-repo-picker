# Step 6 Prompt：Stability & Edge Cases（稳定性与边界情况）

目标：让 local-repo-picker 在**异常环境、极端数据规模、不完整 Git 状态**下仍然稳定运行，
不崩溃、不假死、不给用户制造困惑。

---

## 🎯 本阶段关注点

- 稳定性（Stability）
- 边界情况（Edge Cases）
- 容错与降级（Graceful Degradation）

---

## 1️⃣ 文件系统相关边界情况

### 1.1 扫描路径异常
- scanRoot 不存在
- scanRoot 无权限访问
- scanRoot 是符号链接（可配置是否 follow）
- scanRoot 是网络盘 / iCloud / 慢盘

**要求**
- 不崩溃
- 跳过并记录 warning
- UI 中可提示“部分路径被跳过”

---

### 1.2 仓库路径异常
- repo 在 cache 后被删除
- repo 被移动
- repo 目录存在但 `.git` 损坏 / 不完整

**处理策略**
- 预览阶段识别并提示：
  - “Repository not accessible”
- 下次 refresh 自动清理 cache

---

## 2️⃣ Git 状态异常

### 2.1 Git 不可用
- 系统未安装 git
- git 不在 PATH 中

**要求**
- UI 可启动
- 列表仍可展示
- 预览区显示：
  ```
  Git not available
  ```
- README 说明 git 为可选但强烈推荐

---

### 2.2 仓库内部异常
- detached HEAD
- 无 upstream
- merge/rebase 进行中
- 冲突状态

**展示建议**
- detached HEAD → tag `[detached]`
- 无 upstream → 不显示 ahead/behind
- merge/rebase → tag `[conflict]` 或提示文本

---

## 3️⃣ 大规模数据压力

### 3.1 Repo 数量极大
- 1000+
- 3000+
- 10000+（极端）

**要求**
- UI 启动时间可接受
- 搜索 / 移动不卡死
- Preview 仍然是惰性计算

---

### 3.2 Git 历史极大
- log 很慢
- README 很大

**策略**
- 限制 log 条数（如 12）
- README 行数限制（200）
- 超时或失败直接降级

---

## 4️⃣ UI 交互边界

### 4.1 快速操作
- 快速上下滚动
- 快速切换 filter

**要求**
- debounce 生效
- 不堆积 Promise
- 不出现“旧 repo 的 preview 覆盖新 repo”

---

### 4.2 退出路径
- Esc / q
- Ctrl+C
- Terminal resize

**要求**
- 正常退出
- 恢复终端状态
- 不留下后台进程

---

## 5️⃣ 降级策略（非常重要）

当以下情况发生时，必须降级而不是失败：

| 场景 | 降级行为 |
|----|----|
| git 命令超时 | 显示部分信息 |
| README 读取失败 | 显示 “README unavailable” |
| 单个 repo 出错 | 不影响其他 repo |
| cache 损坏 | 自动 rebuild |

---

## 6️⃣ Debug 与诊断

- DEBUG=1 输出：
  - 被跳过的路径
  - git 调用失败原因（简略）
- 非 DEBUG 模式：
  - 保持安静，不刷屏

---

## 7️⃣ 验收标准

1. 在缺 git 环境下可启动 UI
2. 任意一个 repo 异常不影响整体
3. cache 文件损坏可自动恢复
4. 快速操作下 preview 不错乱
5. 没有未捕获异常

---

> 本阶段目标不是“功能更多”，而是：
> **“在最糟糕的环境下，依然像一个成熟工具那样表现。”**
