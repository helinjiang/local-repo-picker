import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type CommandResult = {
  stdout: string
  stderr: string
}

export type CommandOptions = {
  cwd?: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const normalizedCommand = normalizeCommand(command)
  const normalizedArgs = args.map((arg) => normalizeArg(arg))
  const cwd = options.cwd ? normalizePath(options.cwd) : undefined
  const { stdout, stderr } = await execFileAsync(normalizedCommand, normalizedArgs, {
    cwd,
    timeout: options.timeoutMs,
    env: options.env,
    shell: false,
    windowsHide: true,
    encoding: "utf8"
  })
  return { stdout, stderr: stderr ?? "" }
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new Error("command required")
  }
  if (trimmed.includes("\0")) {
    throw new Error("invalid command")
  }
  return trimmed
}

function normalizeArg(arg: string): string {
  if (arg.includes("\0")) {
    throw new Error("invalid argument")
  }
  return arg
}

function normalizePath(input: string): string {
  if (input.includes("\0")) {
    throw new Error("invalid path")
  }
  return path.resolve(input)
}
