# Coda-CLI

**Coda-CLI**是一款命令行代码辅助开发工具。通过工程化、智能化的集成方案，支持单模型一体化审查/编码与多模型协作（架构规划 + 代码实现），配合 MCP 工具协议与自定义 Skills 规则，全面提升在架构、性能、安全、体验、效率、质量方面的能力。
**Coda-VSCode-Ext**是基于vscode插件的代码辅助开发工具，可在此下载[安装包](https://github.com/Lanscod88/coda-vscode-ext/tree/main/extension-package/)进行体验

# 🛠 技术栈

- 核心语言: TypeScript (Target: ES2022, ModuleResolution: NodeNext)
- 编译与路径处理: tsc + tsc-alias（支持同级目录 src 编译与路径别名 @/\*）
- 交互与终端UI: inquirer（交互式问答）、ora（加载动画）、chalk（终端色彩）
- 文件操作: fs-extra、glob
- 执行模型: 基于生命周期的编排架构

# 🏗 核心架构与生命周期

本项目采用严谨的生命周期驱动模型，每个命令的执行流程均遵循以下阶段：

1. init: 初始化全局状态与基础参数。
2. prompt: 调动 Inquirer 收集用户交互输入。
3. default: 核心计算与数据处理流程。
4. writing: 文件模板生成、写入及配置文件更新。
5. install: 自动拉取或安装所需依赖库。
6. end: 执行收尾工作并输出成功或错误日志。

# 📁 目录结构概览

```text
├── src/
│ ├── bin/ # Coda-CLI执行命令的入口文件
│ ├── cli-core/ # Coda-CLI命令的核心生命周期、基类及状态管理
│ ├── cli-api/ # Coda-CLI底层工具封装（文件系统、git处理、子进程任务等）
│ ├── config/ # 命令及全局配置文件
│ ├── extensions/ # 实际业务命令（通过coda cmd create来生成命令模板并实现具体业务）
│ ├── generator/ # 命令模板管理器（如 cmd-create生成新的命令模板, cmd-delete删除命令模板）
│ ├── service/ # 公共服务（语言包、工具函数等）
│ └── types/ # 公用的类型接口定义文件
├── tsconfig.json # TypeScript 配置文件
├── tsc-alias.json # 路径别名重写配置
└── package.json # 项目配置与依赖管理
```

# 🚀 快速开始与开发指南

1. 安装依赖
   确保已安装 Node.js（推荐 22+ 或最新 LTS 版本），然后安装项目依赖：

```bash
npm install
```

2. 构建与本地链接本项目支持：

```bash
# 编译 TypeScript 并重写路径别名
  npm run build

# 将 Coda-CLI链接到全局以便本地联调
  npm run link
```

# 🐞 VSCode 调试配置

调试前先运行"npm run link",再点击vscode左侧栏“运行和调试”按钮，选中需要调试的命令再点运行即可。

注意：新增业务命令后需要在.vscode/launch.json中添加调试配置项才可调试新增的命令

# 📜 可用命令

| 命令              | 描述                             |
| :---------------- | :------------------------------- |
| `coda cmd create` | 使用Coda-CLI创建实际业务命令模板 |
| `coda cmd delete` | 使用Coda-CLI删除实际业务命令模板 |

📄**License**: [MIT](LICENSE)
