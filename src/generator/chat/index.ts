import {Base, Wait, CLI, ChildProcess} from '@/cli-core';
import {request} from '@/cli-api';
import {AIClient, FileMCPExecutor, ToolRegistry, AgentExecutor} from '@/agent-api';
import {Answers, Quessions} from '@/cli-core/cli';
import {AISettings} from '@/agent-api/types';

/**
 * Coda-CLI运行时的完整状态接口
 */
interface AgentState extends AISettings {
  modelList: string[]; // 可选模型列表
  enableMultiModel: boolean; // 是否启用多模型协作
  architectureModel: string; // 架构设计模型
  implementationModel: string; // 代码实现模型
  taskMode: 'coding' | 'review'; // 单模型工作模式
  userPrompt: string; // 用户任务需求
  success: boolean; // 执行成功标识
  [key: string]: any;
}

/**
 * 通用模型服务连通性校验函数
 */
async function verifyService(baseUrl: string, protocol: string, apiKey?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey && protocol !== 'ollama') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const testUrl = protocol === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
    const response: any = await request.ajax(testUrl, 'get', {headers});

    if (response && response.status !== 'error') {
      return true;
    }
  } catch (e: any) {
    // 捕获网络异常
  }
  return false;
}

Base.extends({
  async init(): Promise<void> {
    Base.state = {
      protocol: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: '',
      model: 'qwen3-coder:30b',
      options: {
        contextSize: 32768,
      },
      modelList: [],
      enableMultiModel: false,
      architectureModel: 'deepseek-r1:32b',
      implementationModel: 'qwen3-coder:30b',
      taskMode: 'coding',
      userPrompt: '',
      success: false,
    } as AgentState;

    CLI.log.debug('run step 1: init done');
    Wait.next();
  },

  async prompt(): Promise<void> {
    // ==========================================
    // 第一步：选择服务协议 (Protocol)
    // ==========================================
    const protocolQuestions: Quessions = [
      {
        type: 'select',
        name: 'protocol',
        message: '请选择服务协议 (Protocol):',
        choices: [
          {name: 'Ollama 协议原生', value: 'ollama'},
          {name: 'OpenAI 兼容协议', value: 'openai'},
        ],
        default: Base.state.protocol,
      },
    ];
    const protocolAnswers: Answers = await CLI.addQuestions(protocolQuestions);
    Base.state.protocol = protocolAnswers.protocol;

    // ==========================================
    // 第二步：设置服务地址与密钥并进行实时连通性校验
    // ==========================================
    const isOllama = Base.state.protocol === 'ollama';
    if (isOllama && !Base.state.baseUrl.includes('11434')) {
      Base.state.baseUrl = 'http://127.0.0.1:11434';
    }

    const connectionQuestions: Quessions = [
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入服务地址 (Base URL):',
        default: Base.state.baseUrl,
        validate: async (value: string) => {
          try {
            new URL(value);
          } catch {
            return '❌ 格式错误：请输入合法的网址（例如：http://127.0.0.1:11434）';
          }

          CLI.log.info(' 正在验证服务连通性与鉴权状态...');
          const isAlive = await verifyService(value, Base.state.protocol, Base.state.apiKey);
          if (!isAlive) {
            return `❌ 连接失败：无法连接到 ${value} 或鉴权未通过，请检查服务状态。`;
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'apiKey',
        message: '请输入密钥 (API Key，若服务器无需鉴权可直接回车):',
        default: Base.state.apiKey || '',
        when: !isOllama,
      },
    ];

    const connectionAnswers: Answers = await CLI.addQuestions(connectionQuestions);
    Base.state.baseUrl = connectionAnswers.baseUrl || Base.state.baseUrl;
    Base.state.apiKey = connectionAnswers.apiKey || '';

    // 动态拉取模型列表
    try {
      const tagsUrl =
        Base.state.protocol === 'ollama'
          ? `${Base.state.baseUrl}/api/tags`
          : `${Base.state.baseUrl}/models`;
      const tagsRes: any = await request.ajax(tagsUrl, 'get');
      if (tagsRes && tagsRes.data && tagsRes.data.models) {
        Base.state.modelList = tagsRes.data.models.map((m: any) => m.name || m.id);
      } else if (Array.isArray(tagsRes)) {
        Base.state.modelList = tagsRes.map((m: any) => m.name || m.id || m);
      }
    } catch (e: any) {
      CLI.log.warn(`获取模型列表失败，将使用默认兜底模型: ${e.message}`);
    }

    if (!Base.state.modelList || Base.state.modelList.length === 0) {
      Base.state.modelList = ['qwen3-coder:30b', 'deepseek-r1:32b'];
    }

    // ==========================================
    // 第三步：选择工作模式（多模型协作 vs 单模型）
    // ==========================================
    const modeQuestions: Quessions = [
      {
        type: 'confirm',
        name: 'enableMultiModel',
        message: '是否启用多模型协作 (架构规划 + 代码实现)?',
        default: false,
      },
    ];
    const modeAnswers: Answers = await CLI.addQuestions(modeQuestions);
    Base.state.enableMultiModel = modeAnswers.enableMultiModel;

    // ==========================================
    // 第四步：根据依赖关系配置具体模型或任务模式
    // ==========================================
    if (Base.state.enableMultiModel) {
      const multiModelQuestions: Quessions = [
        {
          type: 'select',
          name: 'architectureModel',
          message: '请选择 1. 架构设计模型:',
          choices: Base.state.modelList,
          default: Base.state.modelList[1] || Base.state.modelList[0],
        },
        {
          type: 'select',
          name: 'implementationModel',
          message: '请选择 2. 代码实现模型:',
          choices: Base.state.modelList,
          default: Base.state.modelList[0],
        },
      ];
      const multiAnswers: Answers = await CLI.addQuestions(multiModelQuestions);
      Base.state.architectureModel = multiAnswers.architectureModel;
      Base.state.implementationModel = multiAnswers.implementationModel;
      Base.state.model = multiAnswers.implementationModel;
    } else {
      const singleModelQuestions: Quessions = [
        {
          type: 'select',
          name: 'model',
          message: '请选择要调用的 AI 模型:',
          choices: Base.state.modelList,
          default: Base.state.modelList[0],
        },
        {
          type: 'select',
          name: 'taskMode',
          message: '请选择工作模式:',
          choices: [
            {name: '💻 编码实现 (Coding)', value: 'coding'},
            {name: '🔍 代码审查 (Code Review)', value: 'review'},
          ],
          default: 'coding',
        },
      ];
      const singleAnswers: Answers = await CLI.addQuestions(singleModelQuestions);
      Base.state.model = singleAnswers.model;
      Base.state.taskMode = singleAnswers.taskMode;
    }

    // ==========================================
    // 第五步：设置上下文大小与输入任务目标
    // ==========================================
    const currentContext = Base.state.options.contextSize || 32768;
    const finalQuestions: Quessions = [
      {
        type: 'input',
        name: 'contextSize',
        message: '请输入上下文大小 (Context Size，整数，最大 120k):',
        default: String(currentContext),
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

    const finalAnswers: Answers = await CLI.addQuestions(finalQuestions);
    Base.state.options.contextSize = parseInt(finalAnswers.contextSize, 10);
    Base.state.options.architectureModel = Base.state.enableMultiModel
      ? Base.state.architectureModel
      : undefined;
    Base.state.userPrompt = finalAnswers.userPrompt;

    CLI.log.debug('run step 2: prompt done');
    Wait.next();
  },

  async default(): Promise<void> {
    CLI.log.info('🤖 正在初始化本地 AI Agent 运行环境...');

    try {
      const aiSettings: AISettings = {
        protocol: Base.state.protocol,
        baseUrl: Base.state.baseUrl,
        apiKey: Base.state.apiKey,
        model: Base.state.model,
        options: {
          contextSize: Base.state.options.contextSize,
          architectureModel: Base.state.options.architectureModel,
        },
      };

      const aiClient = new AIClient(aiSettings);
      const fileExecutor = new FileMCPExecutor(() => process.cwd());
      const toolRegistry = new ToolRegistry(fileExecutor);
      const agent = new AgentExecutor(aiClient, toolRegistry);

      // 强化系统提示词：强制任何选中的模型识别并执行 MCP 工具调用，而不是当作纯文本输出
      let systemPrompt =
        '你是一个专业的命令行编程助手，可以通过 MCP 工具完成文件读写、目录查看与项目分析。\n' +
        '【重要指令】：当你需要读取文件、修改文件、写入文件或查看目录结构时，必须严格通过工具调用（Tool Call）来执行，绝对不要仅仅在回答中打印代码或 JSON 文本。系统会自动拦截并执行你的工具请求，请等待工具返回结果后再做下一步决策。';

      if (Base.state.enableMultiModel) {
        systemPrompt =
          `你是一个多模型协作编程助手（架构设计模型: ${Base.state.architectureModel} 负责顶层规划，代码实现模型: ${Base.state.implementationModel} 负责具体编码）。\n` +
          '【重要指令】：必须通过 MCP 工具来实际完成文件的读写与修改操作。';
      } else if (Base.state.taskMode === 'review') {
        systemPrompt =
          '你是一个资深的代码审查专家，负责对项目代码进行安全、性能和规范性审查。\n' +
          '【重要指令】：必须通过 MCP 工具去实际读取和检查相关文件，不能凭空猜测。';
      }

      if (Base.state.enableMultiModel) {
        CLI.log.info(
          `🚀 [多模型协作模式] 架构: ${Base.state.architectureModel} | 实现: ${Base.state.implementationModel} | 上下文: ${Base.state.options.contextSize}\n`,
        );
      } else {
        CLI.log.info(
          `🚀 [${Base.state.taskMode === 'review' ? '代码审查模式' : '编码实现模式'}] 模型: ${Base.state.model} | 上下文: ${Base.state.options.contextSize}\n`,
        );
      }

      await agent.run(Base.state.userPrompt, systemPrompt, chunk => {
        process.stdout.write(chunk);
      });

      Base.state.success = true;
    } catch (error: any) {
      CLI.log.error(`AI 任务执行出错: ${error.message}`);
      Base.state.success = false;
    }

    CLI.log.debug('run step 3: default done');
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
