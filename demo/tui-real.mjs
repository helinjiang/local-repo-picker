import path from "node:path"
import { fileURLToPath } from "node:url"
import React from "react"
import { render } from "ink"
import { buildCache } from "../dist/index.js"
import { RepoPicker } from "../dist/ui/index.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../../")
const cacheDir = path.join(__dirname, ".cache")

const cache = await buildCache({
  scanRoots: [root],
  maxDepth: 6,
  pruneDirs: ["node_modules", "dist"],
  cacheFile: path.join(cacheDir, "cache.json"),
  manualTagsFile: path.join(cacheDir, "repo_tags.tsv"),
  lruFile: path.join(cacheDir, "lru.txt")
})

render(
  React.createElement(RepoPicker, {
    repos: cache.repos,
    status: {
      mode: "scan",
      scanDurationMs: cache.metadata?.scanDurationMs
    },
    onSelect: (repo) => {
      console.log(JSON.stringify(repo, null, 2))
    },
    onCancel: () => {
      console.log("cancel")
    }
  })
)
