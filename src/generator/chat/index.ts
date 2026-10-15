import {Base, Wait, CLI, ChildProcess} from '@/cli-core';
import {request} from '@/cli-api';
import {AIClient, FileMCPExecutor, ToolRegistry, AgentExecutor} from '@/agent-api';
import {Answers, Quessions} from '@/cli-core/cli';

/**
 * 封装通用的模型服务连通性校验函数
 * @param baseUrl 服务地址
 * @param exitOnFail 如果连接失败是否直接退出进程
 */
async function verifyService(baseUrl: string, exitOnFail: boolean = false): Promise<boolean> {
  try {
    const response: any = await request.ajax(baseUrl, 'get');
    if (response && response.status !== 'error') {
      return true;
    }
  } catch (e: any) {
    // 捕获网络异常
  }

  if (exitOnFail) {
    CLI.log.error('本地大模型服务没有启动或无法连接');
    process.exit();
  }
  return false;
}

Base.extends({
  async init(): Promise<void> {
    Base.state = {
      modelList: [], // 模型名称列表
      model: 'qwen3-coder:30b', // 默认模型
      baseUrl: 'http://127.0.0.1:11434', // 默认 Ollama 地址
      contextSize: 32768, // 默认上下文 Token 大小
      protocol: 'ollama' as const,
      userPrompt: '',
      success: false,
    };

    // 使用封装的函数进行初始化校验，不通则直接退出
    await verifyService(Base.state.baseUrl, true);

    // 获取本地模型列表逻辑
    try {
      const tagsRes: any = await request.ajax(`${Base.state.baseUrl}/api/tags`, 'get');
      if (tagsRes && tagsRes.data && tagsRes.data.models) {
        Base.state.modelList = tagsRes.data.models.map((m: any) => m.name);
      } else if (tagsRes && tagsRes.models) {
        Base.state.modelList = tagsRes.models.map((m: any) => m.name);
      } else if (Array.isArray(tagsRes)) {
        Base.state.modelList = tagsRes.map((m: any) => m.name || m);
      }
    } catch (e: any) {
      CLI.log.warn(`获取模型列表失败: ${e.message}`);
    }

    // 如果未获取到模型，提供默认兜底选项
    if (!Base.state.modelList || Base.state.modelList.length === 0) {
      Base.state.modelList = ['qwen3-coder:30b'];
    }

    CLI.log.debug('run step 1: init done');
    Wait.next();
  },

  async prompt(): Promise<void> {
    const questions: Quessions = [
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入本地模型服务地址 (Base URL):',
        default: Base.state.baseUrl,
        // 支持异步校验：先校验网址格式，再动态请求验证服务连通性
        validate: async (value: string) => {
          try {
            new URL(value);
          } catch {
            return '❌ 格式错误：请输入合法的网址（例如：http://127.0.0.1:11434）';
          }

          CLI.log.info(' 正在验证服务地址连通性...');
          const isAlive = await verifyService(value, false);
          if (!isAlive) {
            return `❌ 连接失败：无法连接到 ${value}，请确保服务已启动且地址正确`;
          }
          return true;
        },
      },
      {
        type: 'select',
        name: 'model',
        message: '请选择要调用的本地大模型 (上下键选择，回车确认):',
        choices: Base.state.modelList,
        default: Base.state.modelList[0] || 'qwen3-coder:30b',
      },
      {
        type: 'input',
        name: 'contextSize',
        message: '请输入上下文大小 (Context Size，整数，最大 120k):',
        default: String(Base.state.contextSize),
        // 校验数字、整数及最大 120k 范围 (122880)
        validate: (value: string) => {
          const num = Number(value);
          if (isNaN(num) || !Number.isInteger(num)) {
            return '❌ 输入错误：请输入一个有效的整数';
          }
          if (num <= 0 || num > 122880) {
            return '❌ 范围错误：上下文大小必须在 1 到 122880 (120k) 之间';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'userPrompt',
        message: '请输入您希望 AI 助手帮您完成的任务或代码需求:',
        default: '请查看当前目录结构，并分析 package.json 的依赖。',
      },
    ];

    const answers: Answers = await CLI.addQuestions(questions);

    // 通过 answers 设置全局状态值
    Base.state.baseUrl = answers.baseUrl || Base.state.baseUrl;
    Base.state.userPrompt = answers.userPrompt;
    Base.state.contextSize = parseInt(answers.contextSize, 10) || 32768;
    Base.state.model = answers.model || Base.state.modelList[0] || 'qwen3-coder:30b';

    CLI.log.debug('run step 2: prompt done');
    Wait.next();
  },

  async default(): Promise<void> {
    CLI.log.info('🤖 正在初始化本地 AI Agent 运行环境...');

    try {
      // 1. 初始化 AI 客户端
      const aiClient = new AIClient({
        protocol: Base.state.protocol,
        baseUrl: Base.state.baseUrl,
        model: Base.state.model,
        options: {
          contextSize: Base.state.contextSize,
        },
      });

      // 2. 初始化文件工具与注册中心
      const fileExecutor = new FileMCPExecutor(() => process.cwd());
      const toolRegistry = new ToolRegistry(fileExecutor);

      // 3. 初始化 Agent 执行引擎
      const agent = new AgentExecutor(aiClient, toolRegistry);

      CLI.log.info(
        `🚀 AI Agent 开始执行任务 (模型: ${Base.state.model} | 上下文: ${Base.state.contextSize})...\n`,
      );

      // 4. 运行 Agent 并流式输出
      await agent.run(
        Base.state.userPrompt,
        '你是一个专业的命令行编程助手，可以通过 MCP 工具完成文件读写与项目分析。',
        chunk => {
          process.stdout.write(chunk);
        },
      );

      Base.state.success = true;
    } catch (error: any) {
      CLI.log.error(`AI 任务执行出错: ${error.message}`);
      Base.state.success = false;
    }

    CLI.log.debug('run step 3: default done');
    Wait.next();
  },

  async writing(): Promise<void> {
    CLI.log.debug('run step 4: writing done');
    Wait.next();
  },

  async install(): Promise<void> {
    CLI.log.debug('run step 5: install done');
    Wait.next();
  },

  end(): void {
    if (Base.state.success) {
      CLI.log.success('\n✨ AI 编程助手任务执行成功！');
    } else {
      CLI.log.warn('\n⚠️ 任务执行完成，但可能存在异常，请检查上方日志。');
    }
    CLI.log.debug('run step 6: end done');
    Wait.next();
  },
});
