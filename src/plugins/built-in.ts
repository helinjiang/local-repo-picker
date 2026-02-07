import { promises as fs } from "node:fs"
import path from "node:path"
import { execa } from "execa"
import type { Action, PluginModule, PreviewPlugin, TagPlugin } from "../core/types"
import { registerPlugins } from "../core/plugins"
import { refreshCache } from "../core/cache"
import { parseOriginToSiteUrl, readOriginValue } from "../core/origin"

// Node 项目相关的 tag 扩展
const nodeTagPlugin: TagPlugin = {
  id: "builtin.node-tag",
  label: "Node 项目标记",
  apply: async ({ repoPath }) => {
    const packageJson = await readPackageJson(repoPath)
    return packageJson ? ["[node]"] : []
  }
}

// Node 项目相关的 preview 扩展
const nodePreviewPlugin: PreviewPlugin = {
  id: "builtin.node-preview",
  label: "Node 预览扩展",
  render: async ({ repo }) => {
    const packageJson = await readPackageJson(repo.fullPath)
    if (!packageJson) {
      return null
    }
    const name = typeof packageJson.name === "string" ? packageJson.name : "-"
    const scripts =
      packageJson.scripts && typeof packageJson.scripts === "object"
        ? Object.keys(packageJson.scripts).length
        : 0
    return {
      title: "NODE",
      lines: [`NAME: ${name}`, `SCRIPTS: ${scripts}`]
    }
  }
}

// 仅在 CLI 场景需要的依赖参数
type BuiltInActionOptions = {
  scanRoots: string[]
  maxDepth?: number
  pruneDirs?: string[]
  cacheTtlMs?: number
  followSymlinks?: boolean
  cacheFile: string
  manualTagsFile: string
  lruFile: string
}

// 与运行环境无关的通用 actions
function buildCoreActions(): Action[] {
  return [
    {
      id: "builtin.print-path",
      label: "打印此项目路径",
      scopes: ["cli"],
      run: async (repo) => {
        console.log(repo.fullPath)
      }
    },
    {
      id: "builtin.cd-path",
      label: "cd 到此项目",
      scopes: ["cli"],
      run: async (repo) => {
        const shell = process.env.SHELL || "bash"
        await execa(shell, [], { cwd: repo.fullPath, stdio: "inherit", reject: false })
      }
    },
    {
      id: "builtin.open-vscode",
      label: "open in VSCode",
      run: async (repo) => {
        await execa("code", [repo.fullPath], { reject: false })
      }
    },
    {
      id: "builtin.open-iterm",
      label: "open in iTerm",
      run: async (repo) => {
        await execa("open", ["-a", "iTerm", repo.fullPath], { reject: false })
      }
    },
    {
      id: "builtin.open-finder",
      label: "open in Finder",
      run: async (repo) => {
        await execa("open", [repo.fullPath], { reject: false })
      }
    },
    {
      id: "builtin.open-site",
      label: "open site",
      run: async (repo) => {
        const origin = await readOriginValue(repo.fullPath)
        const siteUrl = parseOriginToSiteUrl(origin)
        if (!siteUrl) {
          throw new Error("无法从 origin 解析站点地址")
        }
        await execa("open", [siteUrl], { reject: false })
      }
    },
    {
      id: "web.edit-repo-links",
      label: "编辑固定链接",
      scopes: ["web"],
      run: async () => {}
    }
  ]
}

// 仅 CLI 需要的 actions（涉及本地文件编辑与缓存刷新）
function buildCliActions(options: BuiltInActionOptions): Action[] {
  return [
    {
      id: "builtin.refresh-cache",
      label: "refresh cache",
      scopes: ["cli"],
      run: async () => {
        await refreshCache(options)
      }
    }
  ]
}

// 组装内置插件模块
function buildBuiltInPlugins(options?: BuiltInActionOptions): PluginModule[] {
  const actions = options ? [...buildCoreActions(), ...buildCliActions(options)] : buildCoreActions()
  return [
    {
      id: "builtin.node",
      label: "Node 插件",
      tags: [nodeTagPlugin],
      previews: [nodePreviewPlugin],
      actions
    }
  ]
}

// 便于在外部直接获取默认内置插件（不含 CLI 专属 action）
export const builtInPlugins: PluginModule[] = buildBuiltInPlugins()

export function registerBuiltInPlugins(options?: BuiltInActionOptions): void {
  registerPlugins(buildBuiltInPlugins(options))
}

async function readPackageJson(repoPath: string): Promise<Record<string, unknown> | null> {
  const filePath = path.join(repoPath, "package.json")
  try {
    const content = await fs.readFile(filePath, "utf8")
    const data = JSON.parse(content) as Record<string, unknown>
    return data
  } catch {
    return null
  }
}
