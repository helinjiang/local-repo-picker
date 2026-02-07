import { execa } from "execa"
import type { Action, RepositoryRecord } from "../core/types"
import { getRegisteredActions } from "../core/plugins"
import { registerBuiltInPlugins } from "../plugins/built-in"
import { logger } from "../core/logger"
import type { CliOptions } from "./types"

export async function checkFzfAvailable(): Promise<boolean> {
  try {
    const result = await execa("fzf", ["--version"], {
      stdout: "ignore",
      stderr: "ignore",
      reject: false
    })
    if (result.exitCode === 0) {
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function runFzfPicker(options: CliOptions, filters: Record<string, string>): Promise<string | null> {
  const listResult = await execa("repo", ["__list", "--all"], {
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (listResult.exitCode !== 0) {
    logger.error("repo __list 执行失败")
    return null
  }
  const input = listResult.stdout.trimEnd()
  const binds = buildFzfBinds(filters)
  const args = [
    "--ansi",
    "--delimiter=\t",
    "--with-nth=1",
    "--preview",
    "repo __preview --path {2}",
    "--preview-window=right:60%:wrap",
    "--bind",
    binds
  ]
  const result = await execa("fzf", args, {
    input,
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (result.exitCode !== 0) {
    return null
  }
  const line = result.stdout.trim()
  if (!line) {
    return null
  }
  const parts = line.split("\t")
  return parts[1]?.trim() || null
}

export async function runFzfActionPicker(options: CliOptions): Promise<Action | null> {
  registerBuiltInPlugins(options)
  const actions = getRegisteredActions().filter((action) => isActionAllowed(action, "cli"))
  if (actions.length === 0) {
    return null
  }
  const input = actions.map((item) => `${item.label}\t${item.id}`).join("\n")
  const result = await execa("fzf", ["--delimiter=\t", "--with-nth=1", "--prompt", "Action> "], {
    input,
    stdout: "pipe",
    stderr: "inherit",
    reject: false
  })
  if (result.exitCode !== 0) {
    return null
  }
  const line = result.stdout.trim()
  if (!line) {
    return null
  }
  const id = line.split("\t")[1]
  return actions.find((item) => item.id === id) ?? null
}

function isActionAllowed(action: Action, scope: "cli" | "web"): boolean {
  if (!action.scopes || action.scopes.length === 0) {
    return true
  }
  return action.scopes.includes(scope)
}

function buildFzfBinds(filters: Record<string, string>): string {
  const entries = Object.entries(filters)
  if (entries.length === 0) {
    return "ctrl-a:reload(repo __list --all)"
  }
  const binds = entries.map(([key, tag]) => {
    if (tag === "all") {
      return `${key}:reload(repo __list --all)`
    }
    return `${key}:reload(repo __list --filter-tag ${escapeShellArg(tag)})`
  })
  if (!filters["ctrl-a"]) {
    binds.push("ctrl-a:reload(repo __list --all)")
  }
  return binds.join(",")
}

function escapeShellArg(input: string): string {
  const safe = input.replace(/'/g, "'\"'\"'")
  return `'${safe}'`
}
