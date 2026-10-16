import {Base, Wait, CLI} from '@/cli-core';
import {request} from '@/cli-api';
import {AIClient, FileMCPExecutor, ToolRegistry, AgentExecutor} from '@/agent-api';
import {Answers} from '@/cli-core/cli';
import {AISettings} from '@/agent-api/types';
import {
  getCliRoot,
  loadSavedConfig,
  saveConfig,
  verifyService,
  parseModelInput,
  printTerminalTable,
} from './chat-utils';
import {getSystemPrompt} from '@/agent-api/agent/agent-prompt';

/**
 * Coda-CLI运行时的完整状态接口
 */
interface AgentState extends AISettings {
  modelList: string[];
  enableMultiModel: boolean;
  architectureModel: string;
  implementationModel: string;
  taskMode: 'coding' | 'review';
  userPrompt: string;
  success: boolean;
  savedConfig: AISettings | null;
  [key: string]: any;
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
      savedConfig: loadSavedConfig(),
    } as AgentState;

    CLI.log.debug('run step 1: init done');
    Wait.next();
  },

  async prompt(): Promise<void> {
    const savedConfig: AISettings = Base.state.savedConfig;

    // 1. 检查已有配置并询问复用
    if (savedConfig && savedConfig.baseUrl && savedConfig.model) {
      const isAlive = await verifyService(
        savedConfig.baseUrl,
        savedConfig.protocol,
        savedConfig.apiKey,
      );
      if (isAlive) {
        printTerminalTable(
          '📋 AI 当前配置',
          ['协议', '服务', '模型', '上下文大小'],
          [
            [
              savedConfig.protocol,
              savedConfig.baseUrl,
              savedConfig.model,
              `${savedConfig.options.contextSize}`,
            ],
          ],
        );

        const reuseAns: Answers = await CLI.addQuestions([
          {
            type: 'confirm',
            name: 'reuse',
            message: `检测到已有配置(见上面表格)，是否继续使用？`,
            default: true,
          },
        ]);

        if (reuseAns.reuse) {
          Base.state.protocol = savedConfig.protocol;
          Base.state.baseUrl = savedConfig.baseUrl;
          Base.state.apiKey = savedConfig.apiKey || '';
          Base.state.model = savedConfig.model;
          if (savedConfig.options) {
            Base.state.options = {...Base.state.options, ...savedConfig.options};
            if (savedConfig.options.architectureModel) {
              Base.state.enableMultiModel = true;
              Base.state.architectureModel = savedConfig.options.architectureModel;
              Base.state.implementationModel = savedConfig.model;
            }
          }
          CLI.log.info('✨ 已直接复用现有 AI 配置。');
          CLI.log.debug('run step 2: prompt done (reused)');
          Wait.next();
          return;
        }
      }
    }

    // 2. 选择服务协议
    const protocolAns: Answers = await CLI.addQuestions([
      {
        type: 'select',
        name: 'protocol',
        message: '请选择服务协议 (Protocol):',
        choices: [
          {name: 'Ollama 协议原生', value: 'ollama'},
          {name: 'OpenAI 兼容协议', value: 'openai'},
        ],
        default: savedConfig?.protocol || 'ollama',
      },
    ]);
    Base.state.protocol = protocolAns.protocol;

    const isOllama = Base.state.protocol === 'ollama';
    if (isOllama && !Base.state.baseUrl.includes('11434')) {
      Base.state.baseUrl = 'http://127.0.0.1:11434';
    }

    // 3. 设置服务地址与密钥并校验
    const connectionAns: Answers = await CLI.addQuestions([
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入服务地址 (Base URL):',
        default: savedConfig?.baseUrl || Base.state.baseUrl,
        validate: async (value: string) => {
          try {
            new URL(value);
          } catch {
            return '❌ 格式错误：请输入合法的网址（例如：http://127.0.0.1:11434）';
          }

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
        default: savedConfig?.apiKey || '',
        when: !isOllama,
      },
    ]);

    Base.state.baseUrl = connectionAns.baseUrl;
    Base.state.apiKey = connectionAns.apiKey || '';

    // 4. 动态拉取模型列表
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

      const modelRows = Base.state.modelList.map((m: string, idx: number) => [`[${idx + 1}]`, m]);
      printTerminalTable(`${tagsUrl} 服务可用模型列表`, ['序号', '模型名称'], modelRows);
    } catch (e: any) {
      CLI.log.warn(`获取模型列表失败，将使用默认兜底模型: ${e.message}`);
    }

    if (!Base.state.modelList || Base.state.modelList.length === 0) {
      Base.state.modelList = ['qwen3-coder:30b', 'deepseek-r1:32b'];
    }

    // 5. 选择工作模式
    const modeAnswers: Answers = await CLI.addQuestions([
      {
        type: 'confirm',
        name: 'enableMultiModel',
        message: '是否启用多模型协作 (架构规划 + 代码实现)?',
        default: false,
      },
    ]);
    Base.state.enableMultiModel = modeAnswers.enableMultiModel;

    const modelChoices = Base.state.modelList.map((m: any) => ({name: m, value: m}));

    // 6. 选择具体模型
    if (Base.state.enableMultiModel) {
      const archAnswers: Answers = await CLI.addQuestions([
        {
          type: 'select',
          name: 'architectureModel',
          message: '请选择 1. 架构设计模型(先按回车键，再使用上下箭头选择):',
          choices: modelChoices,
          default: Base.state.modelList[1] || Base.state.modelList[0],
        },
      ]);
      Base.state.architectureModel = archAnswers.architectureModel;

      const implAnswers: Answers = await CLI.addQuestions([
        {
          type: 'select',
          name: 'implementationModel',
          message: '请选择 2. 代码实现模型:',
          choices: modelChoices,
          default: Base.state.modelList[0],
        },
      ]);
      Base.state.implementationModel = implAnswers.implementationModel;
      Base.state.model = implAnswers.implementationModel;
    } else {
      const singleAnswers: Answers = await CLI.addQuestions([
        {
          type: 'select',
          name: 'model',
          message: '请选择要调用的 AI 模型(先按回车键，再使用上下箭头选择):',
          choices: modelChoices,
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
      ]);
      Base.state.model = singleAnswers.model;
      Base.state.taskMode = singleAnswers.taskMode;
    }

    // 7. 设置上下文大小
    const currentContext =
      savedConfig?.options?.contextSize || Base.state.options.contextSize || 32768;
    const contextAnswers: Answers = await CLI.addQuestions([
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
    ]);

    Base.state.options.contextSize = parseInt(contextAnswers.contextSize, 10);
    Base.state.options.architectureModel = Base.state.enableMultiModel
      ? Base.state.architectureModel
      : undefined;

    // 8. 持久化保存配置
    const finalSettings: AISettings = {
      protocol: Base.state.protocol,
      baseUrl: Base.state.baseUrl,
      apiKey: Base.state.apiKey,
      model: Base.state.model,
      options: Base.state.options,
    };
    saveConfig(finalSettings);

    printTerminalTable(
      '📋 AI配置保存',
      ['协议', '服务', '模型', '上下文大小'],
      [
        [
          finalSettings.protocol,
          finalSettings.baseUrl,
          finalSettings.model,
          `${finalSettings.options.contextSize}`,
        ],
      ],
    );
    CLI.log.info('💾 AI 模型配置已成功写入项目配置文件。');

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
      const cliRoot = getCliRoot();
      const fileExecutor = new FileMCPExecutor(() => cliRoot);
      const toolRegistry = new ToolRegistry(fileExecutor);
      const agent = new AgentExecutor(aiClient, toolRegistry);

      // 通过独立模块获取 Prompt
      const systemPrompt = getSystemPrompt(
        Base.state.enableMultiModel,
        Base.state.architectureModel,
        Base.state.implementationModel,
        Base.state.taskMode,
      );

      if (Base.state.enableMultiModel) {
        CLI.log.info(
          `🚀 [多模型协作模式] 架构: ${Base.state.architectureModel} | 实现: ${Base.state.implementationModel} | 上下文: ${Base.state.options.contextSize}\n`,
        );
      } else {
        CLI.log.info(
          `🚀 [${Base.state.taskMode === 'review' ? '代码审查模式' : '编码实现模式'}] 模型: ${Base.state.model} | 上下文: ${Base.state.options.contextSize}\n`,
        );
      }

      let isRunning = true;

      while (isRunning) {
        const inputAnswers: Answers = await CLI.addQuestions([
          {
            type: 'input',
            name: 'userPrompt',
            message: '💬 请输入任务需求 (输入 "退出" 结束):',
            default: '',
          },
        ]);

        const rawInput = (inputAnswers.userPrompt || '').trim();

        if (rawInput === '退出') {
          CLI.log.info('👋 正在退出 AI 编程助手，再见！');
          isRunning = false;
          Base.state.success = true;
          break;
        }

        if (!rawInput) {
          continue;
        }

        CLI.loading.start('🤖 AI 思考中...');
        let firstChunkReceived = false;

        try {
          await agent.run(rawInput, systemPrompt, chunk => {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              CLI.loading.clean();
            }
            process.stdout.write(chunk);
          });
          if (!firstChunkReceived) {
            CLI.loading.clean();
          }
          console.log('\n');
        } catch (err: any) {
          CLI.loading.clean();
          CLI.log.error(`AI 任务执行出错: ${err.message}`);
        }
      }
    } catch (error: any) {
      CLI.log.error(`AI 运行环境初始化出错: ${error.message}`);
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
