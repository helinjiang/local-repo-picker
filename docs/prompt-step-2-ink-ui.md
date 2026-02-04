# Step 2 Prompt：Ink UI（列表 + 搜索）

目标：在已有 RepoInfo[] 基础上实现 Ink TUI（无 git 预览）。

## 要求
- 使用 ink + react
- 左侧列表
- 支持模糊搜索（简单 includes 即可）
- 支持键盘操作：
  - ↑ ↓
  - Enter
  - Esc / q

## UI
- 左侧宽度 40%
- 右侧占位区域（暂不展示内容）
- 顶部显示 repo 数量
- 底部显示快捷键提示

## 输出
- <RepoPicker /> Ink 组件
- 返回选中 RepoInfo
