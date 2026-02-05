# local-repo-picker

在大型 workspace 中快速定位与预览本地 Git 仓库的 fzf 工具。

## 5 分钟上手

1) 安装

```bash
npm i -g local-repo-picker
```

2) 生成配置并填写扫描路径

```bash
repo --config
```

首次运行 `repo` 会启动向导并写入配置，也可手动编辑 `config.json`：

```json
{
  "scanRoots": ["/Users/you/workspace", "/Volumes/repos"],
  "maxDepth": 7,
  "pruneDirs": ["node_modules", "dist", "build"],
  "cacheTtlMs": 43200000,
  "followSymlinks": false,
  "webQuickTags": ["github", "gitee", "dirty"]
}
```

3) 启动 Web UI（推荐）

```bash
repo ui
```

4) 刷新缓存

```bash
repo refresh
```

## 演示

- asciinema 本地演示文件：docs/demo.cast
- 播放方式：

```bash
asciinema play docs/demo.cast
```

## 使用场景

- 本地仓库数量较多（百级 / 千级）时快速筛选
- 通过 Tag 与 LRU 把常用仓库置顶
- 预览 Git 状态、最近提交、README
- 多个 scanRoot 下统一检索

## 功能概览

- 多路径扫描与缓存
- 交互式列表与搜索
- Git 预览（origin / site / branch / status / sync / recent commits / README）
- 标签体系（auto / remote / dirty / manual）
- LRU 最近访问排序
- CLI 输出与配置管理
- Debug 日志

## CLI 使用

```bash
repo --config
repo refresh
repo list
repo list --json
repo list --tsv --sort name
repo list --q backend --tag github
repo list --dirty --sort lru
repo one
repo status
repo status --json
repo ui
repo ui stop
repo ui restart
repo --help
repo --version
```

- `repo`：显示帮助
- `repo --config`：创建默认配置并输出 config.json 路径
- `repo refresh`：强制重建 cache
- `repo list`：输出 repo 列表（支持过滤/排序/格式）
- `repo one`：在当前 git 仓库中选择 action
- `repo ui`：启动本地 Web UI（后台运行，输出 URL 并尝试自动打开浏览器）
- `repo ui stop`：停止 Web UI
- `repo ui restart`：重启 Web UI
- `repo status`：查看 Web UI 状态（输出 URL 或提示）

## 终端交互（可选）

如需终端交互（fzf），请先安装：

```bash
brew install fzf
```

## Internal 命令

仅供 fzf 交互层调用：

- `repo __list --all`
- `repo __list --filter-tag <tag>`
- `repo __preview --path <absolute-path>`

## fzf 预览

右侧预览通过 `repo __preview --path <abs>` 输出，包含 PATH / ORIGIN / BRANCH / STATUS / SYNC / RECENT COMMITS / README（最多 200 行）。

## fzf 快捷键

默认快捷键由配置项 `fzfTagFilters` 控制：

```json
{
  "fzfTagFilters": {
    "ctrl-b": "[byted]",
    "ctrl-g": "[github]",
    "ctrl-e": "[gitee]",
    "ctrl-d": "[dirty]",
    "ctrl-a": "all"
  }
}
```

- `ctrl-a` 恢复全量列表
- 其他键按 tag 过滤（tag 精确包含即可）

## Actions

选择仓库后会进入二次 fzf，执行动作（可通过 Esc 取消并仅输出路径）。

内置动作：

- 打印此项目路径
- cd 到此项目
- open in VSCode
- open in iTerm
- open in Finder
- open site（从 origin 解析站点并在浏览器打开）
- refresh cache

Debug：

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

## Web 快速标签筛选

配置项 `webQuickTags` 决定 Web 顶部的快捷筛选标签：

```json
{
  "webQuickTags": ["github", "gitee", "dirty"]
}
```

## Tag 体系

Tag 由多部分组成：

- remote tag：`[github]` / `[gitee]` / `[internal:host]`
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

## 跨平台兼容

- 路径分隔符自动归一化，`repo_tags.tsv` 与 `lru.txt` 可使用 `/` 或 `\`
- Windows 请确保 `git` 在 PATH 中，建议安装 Git for Windows 或使用 WSL
- WSL 环境下使用 Linux 路径作为 scanRoots，避免混用 Windows 盘符路径
- 终端渲染建议使用现代终端（Windows Terminal / PowerShell 7 / iTerm2 等）

## 插件系统

支持 action / tag / preview 扩展，必须显式注册，插件失败不会影响主流程。

```ts
import {
  registerPlugins,
  registerBuiltInPlugins,
  type PluginModule
} from "local-repo-picker"

registerBuiltInPlugins()

const myPlugin: PluginModule = {
  id: "acme.demo",
  label: "Demo",
  actions: [
    {
      id: "print-path",
      label: "打印路径",
      run: async (repo) => {
        console.log(repo.path)
      }
    }
  ],
  tags: [
    {
      id: "custom-tag",
      label: "自定义标签",
      apply: async ({ repoPath }) => {
        return repoPath.includes("demo") ? ["[demo]"] : []
      }
    }
  ],
  previews: [
    {
      id: "custom-preview",
      label: "预览扩展",
      render: async ({ repo }) => {
        return { title: "EXTRA", lines: [repo.ownerRepo] }
      }
    }
  ]
}

registerPlugins([myPlugin])
```

内置插件：

- Node 项目标记 `[node]`
- Node 预览扩展（name / scripts 数量）
- 打印路径 action

## 安全与威胁模型

- 信任边界：只读取本地文件与执行本机 git，不与外部服务通信
- 命令执行：仅通过受控封装调用 git，禁止 shell，参数以数组传递，并限制子命令白名单
- 路径处理：命令执行路径强制绝对化，避免相对路径被注入
- 输入风险：仓库名与路径可能包含特殊字符，但不会参与 shell 拼接
- 降级策略：git 不可用或超时仅影响预览信息，不影响列表与基础信息展示

## 常见问题

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
A: 扫描阶段使用受控遍历与并发控制，Git 预览只在选中仓库时触发，DEBUG 可查看耗时统计。

**Q: cache 结构变更或损坏怎么办？**  
A: 旧 cache 自动失效或重建，不尝试跨版本兼容。

## 手工验证命令

```bash
repo --help
repo list
repo list --json
repo list --tsv --sort name
repo list --q repo --tag github
repo list --dirty
repo status
repo status --json
repo ui
repo refresh
```

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
