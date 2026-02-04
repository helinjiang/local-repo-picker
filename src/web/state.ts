import { promises as fs } from "node:fs"
import path from "node:path"
import { getConfigPaths } from "../config/config"

export type UiState = {
  pid: number
  port: number
  url: string
  startedAt: number
}

function getStateFile(): string {
  const { dataDir } = getConfigPaths()
  return path.join(dataDir, "ui-state.json")
}

export async function writeUiState(state: UiState): Promise<void> {
  const filePath = getStateFile()
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8")
}

export async function readUiState(): Promise<UiState | null> {
  const filePath = getStateFile()
  try {
    const content = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(content) as UiState
    if (!parsed || typeof parsed.pid !== "number" || typeof parsed.port !== "number") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function clearUiState(): Promise<void> {
  const filePath = getStateFile()
  try {
    await fs.unlink(filePath)
  } catch {
    return
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
