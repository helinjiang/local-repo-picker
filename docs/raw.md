我现在准备用 AICoding 的方式，请根据上述讨论结果，提供 AI Prompt 来写一个 npm 包，要求:

1. 用 ts 来实现
2. 使用 ink 作为 UI；
3. 配置 git 扫描的根目录需要支持多个；
4. npm 包名为 local-repo-picker，支持被引入使用，比如 import xx from 'local-repo-picker'
5. 支持全局安装， bin 为 repo，由于是全局安装，需要支持配置，比如类似 repo --config 这样的命令，可以提示在哪修改
6. UI 交互上，当我上下选择 repo 的时候，fzf 的预览非常好用，我希望用 ink 也能够有类似的实现
