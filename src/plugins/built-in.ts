import { promises as fs } from "node:fs"
import path from "node:path"
import type { Action, PluginModule, PreviewPlugin, TagPlugin } from "../core/types"
import { registerPlugins } from "../core/plugins"

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

const pathActionPlugin: Action = {
  id: "builtin.print-path",
  label: "打印路径",
  run: async (repo) => {
    console.log(repo.path)
  }
}

export const builtInPlugins: PluginModule[] = [
  {
    id: "builtin.node",
    label: "Node 插件",
    tags: [nodeTagPlugin],
    previews: [nodePreviewPlugin],
    actions: [pathActionPlugin]
  }
]

export function registerBuiltInPlugins(): void {
  registerPlugins(builtInPlugins)
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
