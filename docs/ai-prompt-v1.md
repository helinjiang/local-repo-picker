AI Prompt：实现 local-repo-picker（TypeScript + Ink）

你是一个资深 TypeScript / Node.js CLI 工程师。
请实现一个 npm 包 local-repo-picker，要求满足以下功能与工程质量标准。
请直接输出完整项目代码（包含所有文件内容），并确保可运行。

⸻

🎯 目标

实现一个本地 Git 仓库选择器：
	•	命令行运行 repo 启动一个 Ink TUI
	•	左侧列表选择仓库
	•	右侧实时预览（类似 fzf preview）
	•	支持多个扫描根目录
	•	支持缓存 / LRU / 手动 tag
	•	既可作为 CLI 使用，也可被 import 引入

⸻

✅ 必须要求（硬性）

1️⃣ 使用 TypeScript
	•	使用 TypeScript 实现
	•	支持 Node.js 18+ / 20+
	•	构建输出到 dist/
	•	支持：
	•	CLI 正常运行
	•	npm 包可被 import

⸻

2️⃣ 使用 Ink 作为 UI
	•	使用 ink + react
	•	左侧：仓库列表（支持模糊搜索）
	•	右侧：选中仓库的 实时预览

⸻

3️⃣ 支持多个扫描根目录

配置项：

scanRoots: string[]

扫描规则：
	•	最大深度：maxDepth（默认 7）
	•	忽略目录：
	•	pruneDirs: string[]（如 node_modules / dist / build 等）
	•	basename 以 . 或 _ 开头的目录
	•	⚠️ .git 必须例外：用于识别仓库，但不可深入
	•	仓库识别：
	•	.git 是 目录
	•	.git 是 文件（worktree / submodule）

性能要求：
	•	不进入 .git 内部
	•	扫描过程可扩展为并发 / 节流

⸻

4️⃣ npm 包可被 import 使用
	•	npm 包名：local-repo-picker
	•	对外 API 示例：

import pickRepo from 'local-repo-picker';

const result = await pickRepo(options);

返回值类型至少包含：

type PickResult = {
  path: string;
  ownerRepo: string;
  originUrl?: string;
  tags: string[];
};


⸻

5️⃣ 支持全局安装 + CLI
	•	npm i -g local-repo-picker
	•	CLI 命令：

repo             # 启动 UI
repo --config    # 显示并创建配置文件
repo refresh     # 强制重建缓存（推荐）

配置与数据路径（推荐）
使用 env-paths 自动处理平台差异：
	•	config：
	•	macOS: ~/Library/Application Support/local-repo-picker/config.json
	•	cache：
	•	~/Library/Caches/local-repo-picker/repos.json
	•	manual tags：
	•	repo_tags.tsv
	•	LRU：
	•	lru.txt

repo --config 行为：
	•	若 config 不存在 → 创建模板
	•	打印路径 + 提示“在此修改配置”

⸻

6️⃣ Ink 预览区（fzf-like）

当用户上下移动选择时，右侧预览实时更新。

预览内容
	•	PATH（绝对路径）
	•	ORIGIN
	•	优先解析 .git/config
	•	worktree 场景解析 .git 文件中的 gitdir
	•	兜底才调用 git
	•	BRANCH
	•	STATUS
	•	dirty / clean（基于 git status --porcelain）
	•	SYNC
	•	ahead / behind（如存在 upstream）
	•	RECENT COMMITS
	•	最近 12 条
	•	时间精确到秒：YYYY-MM-DD HH:mm:ss
	•	README
	•	README.md / README / README.txt
	•	最多 200 行

性能要求
	•	预览 惰性计算（只在选中时）
	•	git 命令并发限制（推荐 p-limit, 4~8）
	•	预览更新防抖（≈120ms）

⸻

🔖 功能细节（对标现有 shell 版本）

A️⃣ Tag 系统

自动 tag
	•	不加 ROOT tag（冗余）
	•	相对 scanRoot 的一级目录：

~/workspace/gitforgitee/xxx → [gitforgitee]



remote tag（从 origin host 推导）

host	tag
github.com	[github]
gitee.com	[gitee]
code.domain.org / *.domain.org	[domain]
其他	[internal:host]
无 origin	[noremote]

dirty tag
	•	git status --porcelain 非空 → [dirty]

manual tag
	•	文件：repo_tags.tsv
	•	格式：

<abs_path>\t[tag][tag2]


	•	组合规则：
	•	有 manual → remoteTag + manualTags
	•	无 manual → remoteTag + autoTag

⸻

B️⃣ LRU（最近使用）
	•	每次确认选择 repo：
	•	写入 lru.txt（置顶、去重）
	•	最大 300 条
	•	列表排序：
	•	LRU 优先
	•	其余按字母或发现顺序

⸻

C️⃣ Cache
	•	cache 保存：
	•	path
	•	originUrl
	•	ownerRepo
	•	tags（raw）
	•	lastScannedAt
	•	TTL 默认 12h
	•	cache 失效自动 rebuild
	•	repo refresh 强制 rebuild
	•	UI 底部显示 cache 状态 / 扫描耗时

⸻

🧭 UI 交互规范（Ink）

键位
	•	↑ / ↓：移动
	•	Enter：确认并退出
	•	Esc / q：退出返回 null
	•	/ 或 Ctrl+F：搜索
	•	Tab：切换 focus（可选）

布局
	•	左侧列表：40%
	•	右侧预览：60%
	•	顶部：标题 + 过滤状态 + 数量
	•	底部：快捷键提示

⸻

🛠️ 工程要求
	•	包管理：npm / pnpm 均可（推荐 pnpm）
	•	scripts：
	•	build
	•	typecheck
	•	dev（可选）
	•	推荐依赖：
	•	ink, react
	•	env-paths
	•	fast-glob / klaw / readdirp
	•	execa
	•	p-limit
	•	ini
	•	输出 README.md：
	•	安装
	•	配置
	•	使用
	•	路径说明
	•	FAQ

⸻

🧪 验收标准（请自检）
	1.	npm i -g . 后可运行 repo
	2.	repo --config 能创建并提示 config 路径
	3.	UI 能列出多个 scanRoots 下的 repo
	4.	上下移动时右侧预览实时变化（含 commit 时间到秒）
	5.	Enter 后 CLI 至少打印 repo path
	6.	在 Node 项目中可：

import pickRepo from 'local-repo-picker';
const res = await pickRepo();


⸻

🌟 加分项（非必须）
	•	Tag 颜色渲染
	•	owner/repo 优先展示
	•	README Markdown 粗渲染
	•	扫描进度提示

