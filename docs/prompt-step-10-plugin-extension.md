# Step 10 Prompt：Plugin / Extension System

目标：为 local-repo-picker 设计一个**可扩展插件系统**，支持自定义 action / tag / preview 扩展。

## 插件能力

- Action 插件（open in xxx）
- Tag 规则插件
- Preview 扩展插件

## 设计要求

- 插件是纯 JS/TS 模块
- 显式注册，不自动执行
- 插件失败不影响主流程

## 验收

- 内置插件与第三方插件一致对待
- 插件可单独测试
