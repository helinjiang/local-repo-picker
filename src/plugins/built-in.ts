import { promises as fs } from "node:fs"
import path from "node:path"
import { execa } from "execa"
import type { Action, PluginModule, PreviewPlugin, TagPlugin } from "../core/types"
import { registerPlugins } from "../core/plugins"
import { refreshCache } from "../core/cache"
import { parseOriginToSiteUrl, readOriginValue } from "../core/origin"

const nodeTagPlugin: TagPlugin = {
  id: "builtin.node-tag",
  label: "Node 项目标记",
  apply: async ({ repoPath }) => {
    const packageJson = await readPackageJson(repoPath)
    return packageJson ? ["[node]"] : []
  }
}

const nodePreviewPlugin: PreviewPlugin = {
  id: "builtin.node-preview",
  label: "Node 预览扩展",
  render: async ({ repo }) => {
    const packageJson = await readPackageJson(repo.path)
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

function buildBuiltInActions(options?: BuiltInActionOptions): Action[] {
  const actions: Action[] = [
    {
      id: "builtin.print-path",
      label: "打印路径",
      run: async (repo) => {
        console.log(repo.path)
      }
    },
    {
      id: "builtin.open-vscode",
      label: "open in VSCode",
      run: async (repo) => {
        await execa("code", [repo.path], { reject: false })
      }
    },
    {
      id: "builtin.open-iterm",
      label: "open in iTerm",
      run: async (repo) => {
        await execa("open", ["-a", "iTerm", repo.path], { reject: false })
      }
    },
    {
      id: "builtin.open-finder",
      label: "open in Finder",
      run: async (repo) => {
        await execa("open", [repo.path], { reject: false })
      }
    },
    {
      id: "builtin.open-site",
      label: "open site",
      run: async (repo) => {
        const origin = await readOriginValue(repo.path)
        const siteUrl = parseOriginToSiteUrl(origin)
        if (!siteUrl) {
          throw new Error("无法从 origin 解析站点地址")
        }
        await execa("open", [siteUrl], { reject: false })
      }
    }
  ]
  if (options) {
    actions.push(
      {
        id: "builtin.add-tag",
        label: "add tag",
        scopes: ["cli"],
        run: async () => {
          await execa("open", ["-e", options.manualTagsFile], { reject: false })
          await refreshCache(options)
        }
      },
      {
        id: "builtin.refresh-cache",
        label: "refresh cache",
        scopes: ["cli"],
        run: async () => {
          await refreshCache(options)
        }
      }
    )
  }
  return actions
}

export const builtInPlugins: PluginModule[] = [
  {
    id: "builtin.node",
    label: "Node 插件",
    tags: [nodeTagPlugin],
    previews: [nodePreviewPlugin],
    actions: buildBuiltInActions()
  }
]

export function registerBuiltInPlugins(options?: BuiltInActionOptions): void {
  const plugins: PluginModule[] = [
    {
      id: "builtin.node",
      label: "Node 插件",
      tags: [nodeTagPlugin],
      previews: [nodePreviewPlugin],
      actions: buildBuiltInActions(options)
    }
  ]
  registerPlugins(plugins)
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
