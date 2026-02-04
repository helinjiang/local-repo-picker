# Step 9 Prompt：Security & Trust（安全与信任）

目标：确保 local-repo-picker 在处理本地仓库、执行 git / shell / editor 命令时是**安全、可预期、可审计的**。

## 关注点
- 命令执行安全
- 路径安全
- 用户信任边界

## 要求
1. 所有外部命令通过受控封装（execa）
2. 禁止 shell=true
3. 路径必须是绝对路径
4. 防止恶意 repo 名称导致注入
5. 明确 threat model（README）

## 验收
- 任意 repo 名称不影响命令执行
- 无 shell 注入风险
