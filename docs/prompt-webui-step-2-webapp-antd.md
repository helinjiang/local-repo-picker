# Web UI Step 2 Prompt：实现 Web 前端（React + Ant Design）

目标：新增 Web UI 前端，使用 Ant Design 组件，能连接 Step 1 的 API。

## 技术要求
- React + TypeScript
- Ant Design
- Vite（推荐）或其他构建工具（二选一）
- 与 CLI 同仓库（monorepo 或 packages 结构），build 后可被 server 静态托管

## 页面/交互（MVP）
1. 布局：左右分栏（类似 fzf）
   - 左侧：Repo 列表（Table 或 List）
   - 右侧：Preview 面板（Card + Typography + Code/Pre）
2. 顶部工具条：
   - 搜索框（q）
   - Tag 下拉筛选（从 repos 聚合或提供 /api/tags/summary）
   - 刷新 cache 按钮
3. 列表项显示：
   - owner/repo（主）
   - tags（Tag 组件，dirty 红色）
   - origin host（可选）
4. 选择仓库：
   - 点击或键盘上下（可选）
   - 右侧调用 `/api/preview?path=...` 更新预览
5. Actions：
   - 右侧提供 Action 按钮组或 Dropdown：VSCode/iTerm/Finder/Add Tag/Refresh Cache
   - Add Tag：弹窗（Modal）编辑 tags，提交 `/api/tags`

## 输出要求
- 前端项目目录与配置
- 关键组件代码（RepoList, PreviewPanel, ActionsBar）
- 说明如何 build，并被 server 托管（例如 server 静态目录指向 dist）
