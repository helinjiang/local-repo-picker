# Step 4 Prompt：CLI & Config

目标：让 local-repo-picker 成为一个真正可用的 CLI 工具。

## CLI

- bin: repo
- 命令：
  - repo
  - repo --config
  - repo refresh

## Config

- 使用 env-paths
- config.json
- cache.json
- repo_tags.tsv
- lru.txt

## 行为

- repo --config：
  - 创建默认 config
  - 打印路径
- repo refresh：
  - 强制 rebuild cache

## 输出

- cli.ts
- config.ts
- README.md（使用说明）
