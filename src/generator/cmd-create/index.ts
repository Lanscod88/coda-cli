import {Base, Wait, CLI} from '@/cli-core';
import * as API from '@/cli-api';
import {Util} from '@/service/util';
import {Lang} from '@/service/lang';
import CLIConfigData from '@/config/commands.json';
import {CLIConfigType} from '@/types';

const CLIConfig: CLIConfigType = CLIConfigData as CLIConfigType;

let args = process.argv.slice(2);
const npmRootPath = args[0];

const methods = {
  /**
   * 添加到基础配置文件
   */
  addToBaseConfig(folderName: string, description: string, inAnyPath: boolean): void {
    CLI.loading.start(Lang.BUILDIN.ADD_CMD_CONFIG);
    let cmd = folderName.replace(/-/g, ' ');
    let cliCfgPath = API.fs.join(
      npmRootPath,
      CLIConfig.packageName,
      'src',
      'config',
      'commands.json',
    );
    let config = Object.assign({}, CLIConfig);

    config.commands.push({
      command: cmd,
      description: description,
      custom: false,
    });
    config.commands = API.data.arraySort(config.commands, 'command');
    if (!inAnyPath && config.inAnyPath.indexOf(cmd) === -1) {
      config.inAnyPath.push(cmd);
      config.inAnyPath = API.data.arraySort(config.inAnyPath);
    }

    API.fs.writeFile(cliCfgPath, config, true);
    CLI.loading.succeed(Lang.BUILDIN.ADD_CMD_CONFIG_SUCCESS);
  },

  /**
   * 添加到扩展目录
   */
  addToExtensions(folderName: string): void {
    CLI.loading.start(Lang.BUILDIN.ADD_CMD_EXTENSIONS);
    const cmdFolderPath = API.fs.join(
      npmRootPath,
      CLIConfig.packageName,
      'src',
      'extensions',
      folderName,
    );
    const cmdIndexPath = API.fs.join(cmdFolderPath, 'index.js');
    const baseIndexTmpl = API.fs.join(
      npmRootPath,
      CLIConfig.packageName,
      'src',
      'generator',
      'cmd-create',
      'tmpl',
      'index.js',
    );

    API.fs.createFloder(cmdFolderPath);
    API.fs.copyFile(baseIndexTmpl, cmdIndexPath);
    CLI.loading.succeed(Lang.BUILDIN.ADD_CMD_EXTENSIONS_SUCCESS);
  },

  /**
   * 添加到 package.json 的 scripts 中
   */
  addToPkgBin(folderName: string): void {
    const temp = folderName.split('-');
    const cmd = `${CLIConfig.name} ${temp.join(' ')}`;
    CLI.loading.start(Lang.BUILDIN.ADD_CMD_PACKAGE);
    const pkg = API.fs.join(npmRootPath, CLIConfig.packageName, 'package.json');
    const pkgJson = API.fs.readFile(pkg, true);

    if (pkgJson.scripts) {
      pkgJson.scripts[`debug_${folderName}`] = `cross-env DEBUG_ENV=true ${cmd}`;
    }

    API.fs.writeFile(pkg, pkgJson, true);
    CLI.loading.succeed(Lang.BUILDIN.ADD_CMD_PACKAGE_SUCCESS);
  },
};

Base.extends({
  init(): void {
    Base.state = {
      folderName: '',
      description: '',
      isStartUserRootPath: true,
    };

    Wait.next();
  },

  async prompt(): Promise<void> {
    const questions: any[] = [
      {
        type: 'input',
        name: 'folderName',
        message: Lang.BUILDIN.CMD_NAME,
        default: Base.state.folderName,
        validate: (input: string) => {
          let commonValidate = Util.volidateFileName(input);

          if (commonValidate === true) {
            let tempPath = API.fs.join(
              npmRootPath,
              CLIConfig.packageName,
              'src',
              'extensions',
              input,
            );

            if (API.fs.hasPath(tempPath)) {
              return `${input} ${Lang.BUILDIN.EXSITED}`;
            }

            return true;
          } else {
            return commonValidate;
          }
        },
      },
      {
        type: 'input',
        name: 'description',
        message: Lang.BUILDIN.CMD_DESCRIPTION,
        default: Base.state.description,
        validate: (input: string) => {
          if (input.length !== 0) {
            return true;
          } else {
            return false;
          }
        },
      },
      {
        type: 'confirm',
        name: 'isStartUserRootPath',
        message: Lang.BUILDIN.IS_RUN_ANNY_PATH,
        default: true,
      },
    ];

    const answers = await CLI.addQuestions(questions);
    Base.state.folderName = answers.folderName;
    Base.state.description = answers.description;
    Base.state.isStartUserRootPath = answers.isStartUserRootPath;

    Wait.next();
  },

  default(): void {
    Wait.next();
  },

  writing(): void {
    methods.addToBaseConfig(
      Base.state.folderName,
      Base.state.description,
      Base.state.isStartUserRootData ?? Base.state.isStartUserRootPath,
    );
    methods.addToExtensions(Base.state.folderName);
    methods.addToPkgBin(Base.state.folderName);
    Wait.next();
  },

  install(): void {
    Wait.next();
  },

  end(): void {
    CLI.log.success(Lang.MSG_SUCCESS, Lang.BUILDIN.CMD_CREATE_SUCCESS);
    Wait.next();
  },
});
