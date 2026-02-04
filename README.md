# local-repo-picker

面向本地开发者的仓库选择与预览工具，帮助快速在大规模 workspace 中定位目标 repo。

## 项目动机

当本地仓库数量达到几百到上千时，仅靠文件夹跳转和手动搜索会非常低效。local-repo-picker 通过扫描、缓存、标签与可视化预览，让日常在仓库间切换更快、更可控。

## 功能概览

- 扫描多路径仓库并生成缓存
- UI 列表 + 搜索，支持快速选择
- Git 预览（origin / branch / status / sync / recent commits / README）
- 标签体系（auto / remote / dirty / manual）
- LRU 排序支持最近访问置顶
- CLI 输出与配置管理
- Debug 模式与统一日志输出

## 安装

发布版本：

```bash
npm i -g local-repo-picker
```

仅支持 ESM（Node >= 18）。

本地开发：

```bash
npm install
npm run build
npm i -g .
```

源码可省略导入路径的 .js 后缀，构建时会自动补全到 dist 中。

## CLI 使用

```bash
repo
repo --config
repo refresh
```

- `repo`：输出当前 cache 中的 repo 路径
- `repo --config`：创建默认配置并输出 config.json 路径
- `repo refresh`：强制重建 cache

Debug 模式：

```bash
DEBUG=1 repo
```

## 配置与路径

配置文件默认由 env-paths 管理，可通过 `repo --config` 查看实际路径。

文件说明：

- `config.json`：扫描配置
- `cache.json`：缓存数据与 metadata
- `repo_tags.tsv`：手动标签
- `lru.txt`：最近使用列表

如果系统目录无权限，可设置 `LOCAL_REPO_PICKER_DIR` 指定本地目录。

### 配置示例

```json
{
  "scanRoots": ["/Users/you/workspace", "/Volumes/repos"],
  "maxDepth": 7,
  "pruneDirs": ["node_modules", "dist", "build"],
  "cacheTtlMs": 43200000,
  "followSymlinks": false
}
```

## Cache 与 Metadata

- cache 命中时不重新扫描
- cache 过期或 refresh 时触发重建
- metadata 记录扫描耗时、repo 数量、扫描路径等信息

常用字段：

- `metadata.scanDurationMs`
- `metadata.repoCount`
- `metadata.scanRoots`
- `metadata.prunedRepoCount`
- `metadata.warningCount`

## Tag 体系

Tag 由多部分组成：

- remote tag：`[github]` / `[gitee]` / `[domain]` / `[internal:host]`
- auto tag：扫描路径第一层目录，如 `[team-a]`
- dirty tag：工作区有改动时追加 `[dirty]`
- manual tag：从 `repo_tags.tsv` 读取

`repo_tags.tsv` 示例：

```
/path/to/repo-a	[backend][core]
/path/to/repo-b	[infra]
```

## LRU

`lru.txt` 记录最近访问路径，用于调整展示顺序，默认最多 300 条。

## UI 体验

- 顶部状态栏显示缓存 / 扫描状态、仓库数量、当前过滤词
- 右侧预览区域提供 loading 与错误提示
- 扫描路径异常时状态栏提示“部分路径被跳过”
- 键位：↑/↓ 移动，Enter 确认，Esc/q 退出，PgUp/PgDn 或 Ctrl+U/Ctrl+D 滚动预览

## 扩展性

预留 Action 类型：

```ts
type Action = {
  id: string
  label: string
  run(repo: RepoInfo): Promise<void>
}
```

未来可用于扩展打开 VSCode、iTerm、终端执行等行为。

## FAQ

**Q: 没有安装 git 会怎样？**  
A: UI 仍可启动，预览区显示 Git not available，基础信息与 README 可见。

**Q: repo 删除或移动会怎样？**  
A: cache 加载时会剔除不可访问路径，下次 refresh 会修复。

**Q: README 读取失败会怎样？**  
A: 预览区显示 README unavailable，不影响其他信息。

**Q: git 超时或仓库异常会怎样？**  
A: 预览区显示降级提示，仍可浏览列表与非 git 信息。

**Q: scanRoot 是符号链接会怎样？**  
A: 默认跳过并提示，可在配置中开启 followSymlinks。

**Q: 大 workspace 性能如何？**  
A: 扫描阶段使用受控遍历与并发控制，Git 预览只在选中仓库时触发，DEBUG 模式可查看耗时统计。

**Q: cache 结构变更或损坏怎么办？**  
A: 旧 cache 自动失效或重建，不尝试跨版本兼容。

## 测试策略

- 单元测试覆盖扫描、tag、origin 解析、config 默认值等核心逻辑
- 集成测试覆盖扫描 + cache 的关键路径
- UI 侧以人工回归为主，关键状态逻辑做最小化测试

回归清单：

- [ ] UI 可启动
- [ ] repo 列表完整
- [ ] 预览切换正常
- [ ] dirty 判断正确
- [ ] cache refresh 正常
- [ ] repo --config 正常

## 开发命令

```bash
npm run build
npm run typecheck
npm run test
npm run demo:cache
npm run demo:tui
npm run demo:tui-real
```

## 发布与分发

版本策略（SemVer）：

- MAJOR：破坏性变更（CLI 行为 / Config 结构）
- MINOR：新增功能（向后兼容）
- PATCH：修复与优化

发布前检查：

- npm run build
- npm run typecheck
- npm run test
- npm i -g .
- repo

发布：

```bash
npm login
npm publish
```
