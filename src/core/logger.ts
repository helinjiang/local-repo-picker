const debugFlag = (process.env.DEBUG ?? "").toLowerCase()
const debugEnabled =
  debugFlag === "1" ||
  debugFlag === "true" ||
  debugFlag === "yes" ||
  debugFlag === "on" ||
  process.env.LOCAL_REPO_PICKER_DEBUG === "1"

export function isDebugEnabled(): boolean {
  return debugEnabled
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (debugEnabled) {
      console.log(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (debugEnabled) {
      console.log(...args)
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
  }
}
