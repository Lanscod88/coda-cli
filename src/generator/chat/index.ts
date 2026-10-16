import * as fs from 'fs';
import * as path from 'path';
import {Base, Wait, CLI} from '@/cli-core';
import {request} from '@/cli-api';
import {AIClient, FileMCPExecutor, ToolRegistry, AgentExecutor} from '@/agent-api';
import {Answers, Quessions} from '@/cli-core/cli';
import {AISettings} from '@/agent-api/types';

/**
 * 计算字符串在终端中的实际显示宽度（中文字符算 2 个宽度，英文算 1 个）
 */
const getDisplayWidth = (str: string): number => {
  let width = 0;
  for (const char of str) {
    if (char.charCodeAt(0) > 127) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

/**
 * 根据实际显示宽度进行右侧填充对齐
 */
const padEndDisplay = (str: string, targetWidth: number): string => {
  const currentWidth = getDisplayWidth(str);
  const diff = targetWidth - currentWidth;
  return str + ' '.repeat(Math.max(0, diff));
};

/**
 * 通用终端动态表格打印函数（完美支持跨列标题、长标题自适应与连续边框）
 * @param title 表格顶部居中标题
 * @param headers 表头数组 (例如: ['协议', '服务', '模型'])
 * @param rows 二维数据行数组 (例如: [['ollama', 'http://...', 'gemma4:12b']])
 */
const printTerminalTable = (title: string, headers: string[], rows: string[][]): void => {
  const numCols = headers.length;

  // 1. 计算每一列的最大宽度（基于表头和所有行数据），并留出左右各 1 个字符的边距（+2）
  const colWidths: number[] = headers.map((header, colIndex) => {
    const maxLen = Math.max(
      getDisplayWidth(header),
      ...rows.map(row => getDisplayWidth(row[colIndex] || '')),
    );
    return maxLen + 2;
  });

  // 2. 计算表格初始总内部宽度
  let totalInnerWidth = colWidths.reduce((sum, w) => sum + w, 0) + (numCols - 1);

  // 3. 标题长度自适应：如果标题加上边距的宽度大于表格内容总宽度，则动态扩展最后一列的宽度
  const paddedTitleText = ` ${title} `;
  const paddedTitleW = getDisplayWidth(paddedTitleText);
  if (paddedTitleW > totalInnerWidth) {
    const diff = paddedTitleW - totalInnerWidth;
    colWidths[colWidths.length - 1] += diff;
    totalInnerWidth = paddedTitleW;
  }

  // 4. 动态生成各类边框线
  const topBorder = `┌${'─'.repeat(totalInnerWidth)}┐`; // 标题栏顶部的通栏横线
  const titleSeparator = `├${colWidths.map(w => '─'.repeat(w)).join('┬')}┤`; // 标题栏底部的分割线（使用 ┬ 完美衔接下方多列）
  const midBorder = `├${colWidths.map(w => '─'.repeat(w)).join('┼')}┤`; // 数据行之间的分割线（使用 ┼）
  const btmBorder = `└${colWidths.map(w => '─'.repeat(w)).join('┴')}┘`; // 表格底部的边框（使用 ┴）

  // 5. 标题行居中处理（两侧带 │ 边界，内部居中对齐）
  const leftPad = Math.floor((totalInnerWidth - paddedTitleW) / 2);
  const rightPad = totalInnerWidth - paddedTitleW - leftPad;
  const finalTitleLine =
    ' '.repeat(Math.max(0, leftPad)) + paddedTitleText + ' '.repeat(Math.max(0, rightPad));

  // 6. 打印表格
  CLI.log.info('');
  CLI.log.info(topBorder);
  CLI.log.info(`│${finalTitleLine}│`);
  CLI.log.info(titleSeparator); // 关键：使用 ┬ 衔接下方的多列，彻底解决竖线断开/悬空问题

  // 打印表头
  const headerStr = headers.map((h, i) => padEndDisplay(h, colWidths[i])).join('│');
  CLI.log.info(`│${headerStr}│`);
  CLI.log.info(midBorder);

  // 打印数据行
  rows.forEach(row => {
    const rowStr = row.map((cell, i) => padEndDisplay(cell || '', colWidths[i])).join('│');
    CLI.log.info(`│${rowStr}│`);
  });

  CLI.log.info(btmBorder + '\n');
};

/**
 * 获取 code-agent 的根目录，优先从环境变量获取，兜底使用当前工作目录
 */
const getCliRoot = (): string => process.env.cliRoootPath || process.cwd();

/**
 * 获取配置文件路径
 */
const getConfigPath = (): string => path.join(getCliRoot(), 'src', 'config', 'commands.json');

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
  savedConfig: AISettings | null; // 本地已有配置缓存
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

/**
 * 加载本地保存的 AI 配置，并检查是否为有效配置（过滤默认空值）
 */
function loadSavedConfig(): AISettings | null {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(raw);
      const setting: AISettings = data.aiSetting;
      if (setting && setting.protocol && setting.baseUrl && setting.model && setting.options) {
        if (
          setting.protocol.length !== 0 &&
          setting.baseUrl.length !== 0 &&
          setting.model.length !== 0 &&
          setting.options.contextSize > 0
        ) {
          return setting;
        }
        return null;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * 保存 AI 配置到项目的 commands.json 中
 */
function saveConfig(settings: AISettings) {
  try {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
    let existing: any = {};
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    existing.aiSetting = settings;
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch (e) {}
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

    // 1. 如果存在有效配置，先尝试静默验证连通性并询问是否复用
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

      // 此处标题过长时会自动扩展表格宽度，防止边框断开
      printTerminalTable(`${tagsUrl} 服务可用模型列表`, ['序号', '模型名称'], modelRows);
    } catch (e: any) {
      CLI.log.warn(`获取模型列表失败，将使用默认兜底模型: ${e.message}`);
    }

    if (!Base.state.modelList || Base.state.modelList.length === 0) {
      Base.state.modelList = ['qwen3-coder:30b', 'deepseek-r1:32b'];
    }

    // 5. 选择工作模式（多模型协作 vs 单模型）
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

    // 8. 持久化保存配置（使用实时更新的 Base.state 属性，保证模型名称正确显示）
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

      let systemPrompt =
        '你是一个专业的命令行编程助手，可以通过 MCP 工具完成文件读写、目录查看与项目分析。\n\n' +
        '【核心行为准则】：\n' +
        '1. **概念、语法与理论问题**：请直接通过纯文本回答用户，绝对不要调用任何工具。\n' +
        '2. **项目实操任务**：必须严格通过工具调用（Tool Call）来执行。';

      if (Base.state.enableMultiModel) {
        systemPrompt =
          `你是一个多模型协作编程助手（架构设计模型: ${Base.state.architectureModel} 负责顶层规划，代码实现模型: ${Base.state.implementationModel} 负责具体编码）。\n` +
          '【核心行为准则】：对于项目实操任务，必须通过 MCP 工具来实际完成文件的读写与修改。';
      } else if (Base.state.taskMode === 'review') {
        systemPrompt =
          '你是一个资深的代码审查专家，负责对项目代码进行安全、性能和规范性审查。\n' +
          '【核心行为准则】：必须通过 MCP 工具去实际读取和检查相关项目文件。';
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
