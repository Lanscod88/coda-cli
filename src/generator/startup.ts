import * as path from 'path';
import {fork} from 'child_process';
import {CLI, ChildProcess} from '@/cli-core';
import {packages} from '@/cli-api';
import {Lang} from '@/service/lang';
import CLIConfigData from '@/config/commands.json';
import {CLIConfigType, CommandItem, LikeCommandResult} from '@/types';

const CLIConfig: CLIConfigType = CLIConfigData as CLIConfigType;

CLI.loading.start(Lang.BUILDIN.CORE_STRTUP_READY);

// 判断是否为 VS Code 本地调试环境
const isDebug = process.env.DEBUG_ENV === 'true';
const globalNpmRoot = ChildProcess.syncCmdExecuteResult('npm root -g');

// 如果是本地调试，根目录指向当前项目根目录；否则指向全局包目录
let currentProjectRoot = isDebug
  ? path.resolve(__dirname, '../../') // 从 src/bin 往上两级到达项目根目录
  : path.join(globalNpmRoot, CLIConfig.packageName);

let npmRootPath = isDebug ? currentProjectRoot : globalNpmRoot;
let cliRoootPath = currentProjectRoot;

process.env.cliRoootPath = cliRoootPath; //把工具的实际路径写入node环境变量，方便后续命令执行获取

/**
 * 获取 CLI 配置对象
 */
function getCLIConfig(): CLIConfigType {
  return {
    packageName: CLIConfigData.packageName,
    wordsLen: CLIConfigData.wordsLen,
    name: CLIConfigData.name,
    commands: CLIConfigData.commands as CommandItem[],
    inAnyPath: CLIConfigData.inAnyPath,
    buildIn: CLIConfigData.buildIn,
    store: CLIConfigData.store,
  };
}

/**
 * 显示帮助信息
 * @param name CLI 名称
 * @param commands 命令列表
 */
function showHelp(name: string, commands: CommandItem[]): void {
  let helpList: string[] = [];
  commands.forEach(cmd => {
    helpList.push(`${name} ${cmd.command} : ${cmd.description}`);
  });

  helpList.push(name + ' ' + Lang.HELP_MESSAGE);
  const helps = `Usage: ${name} [command] \nCommands:\n\t${helpList.join('\n\t')}`;
  CLI.loading.succeed(Lang.BUILDIN.CLI_HAS_READY);
  CLI.log.info(helps);

  process.exit(0);
}

/**
 * 检查是否存在相似或匹配的命令
 * @param input 输入的命令
 * @param commands 命令列表
 */
function hasLikeCommand(input: string, commands: CommandItem[]): LikeCommandResult {
  let exsited = false;
  let likeList = commands.filter(cmd => {
    if (cmd['command'] === input) {
      exsited = true;
      return false;
    } else {
      let temp = input.split(' ');
      if (cmd['command'].includes(temp[0])) {
        return true;
      }
      return false;
    }
  });

  return {
    exsited,
    likeList,
  };
}

/**
 * 验证命令合法性
 * @param option 选项/输入内容
 * @param name CLI 名称
 * @param commands 命令列表
 */
function validateCommand(option: string, name: string, commands: CommandItem[]): LikeCommandResult {
  const {exsited, likeList} = hasLikeCommand(option, commands);

  if (!exsited) {
    let formatVal = option.toLowerCase();
    switch (formatVal) {
      case '--h':
        showHelp(name, commands);
        break;
      default:
        if (likeList.length !== 0) {
          let likes: string[] = [];
          likeList.forEach(cmd => {
            likes.push(`${name} ${cmd.command}`);
          });

          if (likes.length !== 0) {
            CLI.loading.succeed(Lang.BUILDIN.CLI_HAS_READY);
            CLI.log.error(
              Lang.MSG_ERROR,
              `${Lang.BUILDIN.NO_COMMAND} "${name} ${option}"`,
              `${Lang.BUILDIN.MEAN_SUCH}\n\t${likes.join('\n\t')}`,
            );
            process.exit();
          }
        } else {
          CLI.loading.succeed(Lang.BUILDIN.CLI_HAS_READY);
          CLI.log.error(Lang.MSG_ERROR, `${Lang.BUILDIN.NO_COMMAND} "${name} ${option}".`);
          process.exit();
        }
        break;
    }
  }

  return {
    exsited,
    likeList,
  };
}

/**
 * 检查并自动更新 CLI 或相关依赖
 */
async function autoUpdate(): Promise<void> {
  let pkg = path.join(cliRoootPath, 'package.json'); // 找到 CLI 自身的 PKG，真实位置在 NPM 全局安装目录下
  CLI.loading.start(Lang.BUILDIN.CORE_CHECKING_UPDATE);

  let pkgJSON = require(pkg);
  let storeUrl = CLIConfig.store;
  let url = path.join(storeUrl, CLIConfig.packageName);
  let cliVersion = await packages.checkVersion(url, pkgJSON.version);
  if (JSON.stringify(cliVersion) === '{}') {
    CLI.loading.info(Lang.BUILDIN.CORE_LATEST_VERSION);

    /** 以下是检测 code-agent 依赖包版本的预留逻辑 */
  } else {
    CLI.loading.info(Lang.BUILDIN.CORE_UPDATE_READY); // 升级 CLI 需要切换目录到 NPM 全局安装目录
    CLI.log.printObject(cliVersion);
    const task = 'npm install -g code-agent --loglevel info --timing';
    if (process.platform === 'win32') {
      ChildProcess.taskInNewWindow(task, npmRootPath, true);
    } else {
      CLI.log.warn(Lang.BUILDIN.CORE_LINUX_INPUT_ROOT_USER_PASSWORD);
      ChildProcess.taskInNewWindow(`sudo ${task}`, npmRootPath, true);
    }
  }
}

/**
 * 引导和执行命令的主逻辑
 */
async function guideCommand(): Promise<void> {
  const {wordsLen, name, commands, inAnyPath, buildIn} = getCLIConfig();
  const currArgs = process.argv.slice(2);
  const cmdLen = currArgs.length;
  if (cmdLen === 0) {
    showHelp(name, commands);
  }

  if (cmdLen <= wordsLen) {
    let cmdOptions = currArgs.join(' ');

    let main = `${path.join('extensions', currArgs.join('-'), 'index.js')}`;
    if (buildIn.indexOf(cmdOptions) > -1) {
      main = `${path.join('generator', currArgs.join('-'), 'index.js')}`;
    }

    const {exsited} = validateCommand(cmdOptions, name, commands);

    if (exsited) {
      let baseEnvConfig = JSON.stringify({
        input: cmdOptions,
        commands,
        wordsLen,
        name,
        inAnyPath,
      });
      process.env['CLI_ENV'] = baseEnvConfig;
      CLI.loading.succeed(Lang.BUILDIN.CLI_VOLIDATE_CMD_SUCCESS);

      const loadProgram = (): void => {
        let programPath = isDebug
          ? path.join(currentProjectRoot, 'src', main)
          : path.join(globalNpmRoot, CLIConfig.packageName, 'src', main);

        let child = fork(programPath, [npmRootPath], {
          silent: false,
        });

        child.on('error', (error: Error) => {
          console.clear();
          CLI.log.error(error.message, error.stack);
          autoUpdate();
        });

        child.on('exit', (code: number | null) => {
          if (code === 0) {
            autoUpdate();
          }
        });
      };
      loadProgram();
    } else {
      CLI.loading.succeed(Lang.BUILDIN.CLI_HAS_READY);
      CLI.log.error(Lang.MSG_ERROR, `${Lang.BUILDIN.NO_COMMAND} "${name} ${currArgs.join(' ')}"`);
      process.exit();
    }
  } else {
    CLI.loading.succeed(Lang.BUILDIN.CLI_HAS_READY);
    CLI.log.error(Lang.MSG_ERROR, Lang.BUILDIN.COMMAND_LENGTH_TOO_LONG);
    process.exit();
  }
}

guideCommand();
