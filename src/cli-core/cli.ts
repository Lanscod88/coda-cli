import ora from 'ora';
import chalk from 'chalk';
import inquirer, {Answers} from 'inquirer';
export type {Answers} from 'inquirer';

// 1. inquirer官方支持的所有 Prompt 类型
export type PromptType =
  | 'input'
  | 'number'
  | 'confirm'
  | 'select'
  | 'list'
  | 'rawlist'
  | 'expand'
  | 'checkbox'
  | 'password'
  | 'editor'
  | (string & {});

// 2. inquirer官方 Choices 项的结构定义（支持字符串、数字、对象或分隔符）
export interface ChoiceObject {
  name?: string;
  value?: any;
  short?: string;
  disabled?: boolean | string;
  [key: string]: any;
}

export type ChoiceItem = string | number | ChoiceObject | any;

// 3. 基于inquirer官方文档完整规范定义的 Question 接口
export interface Question<T extends Answers = Answers> {
  // 核心基础字段
  type?: PromptType;
  name?: string;
  message?: string | ((answers: T) => string | Promise<string>);
  default?: any | ((answers: T) => any | Promise<any>);
  choices?: ChoiceItem[] | ((answers: T) => ChoiceItem[] | Promise<ChoiceItem[]>);

  // 校验、过滤与转换
  validate?: (input: any, answers: T) => boolean | string | Promise<boolean | string>;
  filter?: (input: any, answers: T) => any;
  transformer?: (input: any, answers: T, flags: {isFinal: boolean}) => string | Promise<string>;
  when?: boolean | ((answers: T) => boolean | Promise<boolean>);

  // 样式与布局控制字段
  pageSize?: number;
  prefix?: string;
  suffix?: string;

  // 行为控制字段
  askAnswered?: boolean;
  loop?: boolean;
  waitUserInput?: boolean;

  // 兼容其他自定义扩展字段
  [key: string]: any;
}

// 4. 兼容单个问题、数组或只读数组的复合类型（对应 PromptSession 逻辑）
export type Quessions = Question | Question[] | readonly Question[];

/**
 * CLI 交互与日志工具函数
 */
export function cli() {
  const spinner = ora({
    interval: 70,
  });

  function clean(): void {
    spinner.stop();
    spinner.text = '';
  }

  return {
    /**
     * 为 CLI 提示添加交互问题
     * @param questions 使用 inquirer 配置，请参阅文档 https://www.npmjs.com/package/inquirer
     * @returns 返回 Promise 对象
     */
    async addQuestions(questions: Quessions): Promise<Answers> {
      return await inquirer.prompt(questions as any);
    },

    /**
     * 加载中动画方法集合
     */
    loading: {
      /**
       * 开始加载动画
       * @param text 提示文本
       */
      start(text: string): void {
        clean();
        spinner.start(`${text}\n`);
      },

      /**
       * 显示成功状态
       * @param text 提示文本
       */
      succeed(text: string): void {
        clean();
        spinner.succeed(text);
      },

      /**
       * 显示失败状态
       * @param text 提示文本
       */
      fail(text: string): void {
        clean();
        spinner.fail(text);
      },

      /**
       * 显示警告状态
       * @param text 提示文本
       */
      warn(text: string): void {
        clean();
        spinner.warn(text);
      },

      /**
       * 显示信息状态
       * @param text 提示文本
       */
      info(text: string): void {
        clean();
        spinner.info(text);
      },

      /**
       * 清除加载状态
       */
      clean,
    },

    /**
     * 控制台日志输出方法集合
     */
    log: {
      /**
       * 输出普通信息日志
       * @param msg 消息文本
       * @param datas 附加数据
       */
      info(msg: string, ...datas: any[]): void {
        console.log(chalk.gray.bold(msg, ...datas));
      },

      /**
       * 输出成功日志
       * @param msg 消息文本
       * @param datas 附加数据
       */
      success(msg: string, ...datas: any[]): void {
        console.log(chalk.green.bold(msg, ...datas));
      },

      /**
       * 输出错误日志
       * @param msg 消息文本
       * @param datas 附加数据
       */
      error(msg: string, ...datas: any[]): void {
        console.log(chalk.red.bold(msg, ...datas));
      },

      /**
       * 输出警告日志
       * @param msg 消息文本
       * @param datas 附加数据
       */
      warn(msg: string, ...datas: any[]): void {
        console.log(chalk.hex('#FF8880').bold(msg, ...datas));
      },

      /**
       * 深度打印 JSON 对象
       * @param obj JSON 对象
       */
      printObject(obj: any): void {
        console.dir(obj, {depth: null});
      },

      /**
       * 仅在调试模式下打印。如果使用此方法，需设置 process.env['DEBUG_ENV'] = 'true'
       * @param msg 消息文本
       * @param datas 附加数据
       */
      debug(msg: string, ...datas: any[]): void {
        if (process.env['DEBUG_ENV'] === 'true') {
          console.log(chalk.blue.bold(msg, ...datas));
        }
      },
    },
  };
}

export default cli;
