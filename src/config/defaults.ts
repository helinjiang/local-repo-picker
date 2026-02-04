import type { AppConfig } from "./schema.js"

export const defaultConfig: AppConfig = {
  scanRoots: [],
  maxDepth: 7,
  pruneDirs: [],
  cacheTtlMs: 12 * 60 * 60 * 1000
}
