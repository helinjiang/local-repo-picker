# 更新日志

## [0.4.1] - 2026-02-09

### 新增

- Web 标签支持重命名（仅手动标签）
- Web 快速标签管理支持拖拽排序
- CLI 交互头部展示快捷搜索绑定

### 变更

- Web 搜索覆盖 relativePath 与 repoKey
- CLI 搜索覆盖 relativePath 与 repoKey
- CLI 列表默认显示 relativePath
- CLI 列表新增 repoKey 列，并调整 fzf 交互列顺序
- fzf 交互调用 CLI 自身，避免依赖全局 repo 命令

### 修复

- fzf 预览在新增列后路径列错位

## [0.4.0] - 2026-02-07

### 新增

- codePlatform 属性与列表展示
- 列表首行展示状态

### 变更

- repoKey 与列表 key 统一算法
- folderRelativePath 改为相对 scanRoots 的路径
- remoteTag 从 tags 中移除，dirty 独立于 tags

## [0.3.1] - 2026-02-06

### 新增

- Web 快速标签筛选与配置入口
- repo one 在当前仓库直接选择 action
- CLI action 增加进入目录

### 变更

- Web 标签展示与输入去除中括号
- CLI 结构拆分至 cli 目录

### 修复

- Web 刷新缓存接口空 body 报错
- 刷新缓存按钮加 loading 防重复点击

## [0.3.0] - 2026-02-05

### 新增

- Web UI 与本地静态托管
- repo ui 后台运行，支持 stop / restart / status
- repo list / status 命令与 JSON/TSV 输出
- Web API 分页、预览缓存与并发限制
- 预览新增站点链接与打开站点 action

### 变更

- Web UI Actions 增加图标

## [0.2.0] - 2026-02-04

### 新增

- 扫描阶段对跳过路径与符号链接的告警
- 缓存 metadata 记录扫描/构建耗时与告警计数
- Git 不可用、超时或仓库异常时预览降级
- 基于 Vitest 的核心逻辑测试套件

### 变更

- 源码导入路径无需 .js 后缀
- 构建阶段自动补全 ESM 扩展名

### 修复

- 缓存损坏时自动重建
