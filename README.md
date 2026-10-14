# Coda-CLI

一款命令行工具，可以调用本地AI模型的编程助手，通过工程化、智能化集成方案，推动前端项目在架构、性能、安全、体验、效率、质量全面提升。

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
code-agent/
├── src/
│ ├── bin/ # code-agent执行命令的入口文件
│ ├── cli-core/ # code-agent命令的核心生命周期、基类及状态管理
│ ├── cli-api/ # code-agent底层工具封装（文件系统、git处理、子进程任务等）
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

2. 构建与本地链接本项目支持 TypeScript 源码同级编译（src/ 到 src/），并配置了路径别名映射：

```bash
# 编译 TypeScript 并重写路径别名
  npm run build

# 将 CLI 工具链接到全局以便本地联调 (coda 命令)
  npm run link
```

# 🐞 VS Code 调试配置

点击vscode左侧栏“运行和调试”按钮，选中需要调试的命令再点运行即可。

# 📜 可用脚本命令

| 命令                       | 描述                                   |
| :------------------------- | :------------------------------------- |
| `npm run build`            | 编译 TypeScript 文件并自动转换路径别名 |
| `npm run link`             | 构建并注册全局 coda 命令               |
| `npm run debug_cmd-create` | 调试创建自定义命令流程                 |
| `npm run debug_cmd-delete` | 调试删除自定义命令流程                 |

📄**License**: [MIT](LICENSE)
