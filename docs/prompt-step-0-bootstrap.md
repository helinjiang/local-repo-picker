# Step 0 Prompt：项目初始化与工程骨架（TypeScript + Ink）

目标：为 local-repo-picker 建立一个**可持续演进的工程骨架**，为后续 Step 1~4 打好基础。

---

## 要求
- 使用 TypeScript
- Node.js 18+ / 20+
- 支持 ESM（推荐）或 CJS（二选一，需说明）
- 使用 pnpm 或 npm（二选一，需说明）
- 提供最小可运行的 CLI（暂不做功能）

---

## 工程结构（建议）
```
local-repo-picker/
  package.json
  tsconfig.json
  src/
    index.ts        # library entry (export default pickRepo)
    cli.ts          # CLI entry (bin: repo)
    config/
      paths.ts      # env-paths 封装
      schema.ts     # Config 类型
      defaults.ts   # 默认配置
    core/
      types.ts
  dist/
  README.md
```

---

## package.json
- name: local-repo-picker
- version: 0.1.0
- type: module（若使用 ESM）
- bin:
  - repo -> dist/cli.js
- exports:
  - "." -> dist/index.js
- scripts:
  - build
  - typecheck
  - dev（可选）

---

## tsconfig
- target: ES2020 或更新
- moduleResolution: node
- strict: true
- outDir: dist
- rootDir: src

---

## CLI（最小实现）
- 运行 `repo` 时打印：
  - "local-repo-picker (bootstrap)"
- 支持：
  - `repo --config`（暂时只打印占位提示）

---

## Library API（占位）
```ts
export default async function pickRepo(): Promise<null> {
  return null;
}
```

---

## README（最小）
- 项目简介
- 安装方式
- CLI 占位说明
- 后续步骤指引（Step 1~4）

---

## 验收
1. pnpm install / npm install
2. pnpm build
3. npm i -g .
4. repo 能正常运行
5. 可在 Node 项目中 import

---

> 本步骤只做“骨架 + 通路打通”，不引入扫描 / UI / git 逻辑。
> 完成后进入 Step 1。
