import { isDebugEnabled, logger } from "../core/logger"

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "未知错误"
  }
  if (typeof error === "string") {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return "未知错误"
  }
}

export function handleFatalError(error: unknown): void {
  const message = formatError(error)
  logger.error(`发生错误: ${message}`)
  if (isDebugEnabled() && error instanceof Error && error.stack) {
    logger.error(error.stack)
  }
  process.exitCode = 1
}
