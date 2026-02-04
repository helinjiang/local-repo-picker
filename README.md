# local-repo-picker

本地代码仓库选择工具的工程骨架。

## 安装

```bash
npm install
npm run build
npm i -g .
```

## CLI

```bash
repo
repo --config
repo refresh
```

## 配置与路径

- `repo --config` 会创建默认配置并输出配置文件路径
- `config.json`：扫描配置
- `cache.json`：缓存文件
- `repo_tags.tsv`：手动标签
- `lru.txt`：最近使用列表

路径由 env-paths 决定，可用 `repo --config` 查看 config.json 的位置
如果系统目录无权限，可设置 `LOCAL_REPO_PICKER_DIR` 指定本地目录

## 后续步骤

按提示继续执行 Step 1 ~ Step 4。
