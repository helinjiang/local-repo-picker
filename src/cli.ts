#!/usr/bin/env node

const args = process.argv.slice(2)

if (args.includes("--config")) {
  console.log("config: todo")
} else {
  console.log("local-repo-picker (bootstrap)")
}
