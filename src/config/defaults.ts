import type { AppConfig } from "./schema"

export const defaultConfig: AppConfig = {
  scanRoots: [],
  maxDepth: 7,
  pruneDirs: [],
  cacheTtlMs: 12 * 60 * 60 * 1000
}
