import {Base, Wait, CLI} from '@/cli-core';
import * as API from '@/cli-api';
import {Util} from '@/service/util';
import {Lang} from '@/service/lang';
import CLIConfigData from '@/config/commands.json';
import {CLIConfigType, CommandItem} from '@/types';

// 导入的 JSON 默认是只读的，通过深拷贝一份可修改的配置对象
const CLIConfig: CLIConfigType = JSON.parse(JSON.stringify(CLIConfigData));

let args = process.argv.slice(2);
const npmRootPath = args[0];

Base.extends({
  init(): void {
    Base.state = {
      folderName: '',
      canDelete: false,
      deleteFolder: '',
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
              Base.state.canDelete = true;
              Base.state.deleteFolder = tempPath;
              return true;
            }

            return true;
          } else {
            return commonValidate;
          }
        },
      },
    ];

    const answers = await CLI.addQuestions(questions);
    Base.state.folderName = answers.folderName;
    Wait.next();
  },

  writing(): void {
    if (Base.state.canDelete) {
      CLI.loading.start(Lang.BUILDIN.DELETE_COMMAND_TIPS);
      API.fs.deleteFolder(Base.state.deleteFolder, true);

      const commands = CLIConfig.commands;
      const inAnyPath = CLIConfig.inAnyPath;
      let newCommands: CommandItem[] = [];
      let newInAnyPath: string[] = [];
      let cmdName = Base.state.folderName.split('-').join(' ');

      commands.forEach(item => {
        if (item.command !== cmdName) {
          newCommands.push(item);
        }
      });

      inAnyPath.forEach(item => {
        if (item !== cmdName) {
          newInAnyPath.push(item);
        }
      });

      CLIConfig.commands = newCommands;
      CLIConfig.inAnyPath = newInAnyPath;

      const CLIConfigPath = API.fs.join(
        npmRootPath,
        CLIConfig.packageName,
        'src',
        'config',
        'commands.json',
      );
      API.fs.writeFile(CLIConfigPath, CLIConfig, true);

      const pkgPath = API.fs.join(npmRootPath, CLIConfig.packageName, 'package.json');
      let pkgConfig = API.fs.readFile(pkgPath, true);
      const scripts = pkgConfig.scripts || {};
      let debugName = `debug_${Base.state.folderName}`;

      if (debugName in scripts) {
        delete scripts[debugName];
      }

      API.fs.writeFile(pkgPath, pkgConfig, true);
      CLI.loading.succeed(Lang.BUILDIN.DELETE_COMMAND_SUCCESS);
    }

    Wait.next();
  },

  end(): void {
    if (!Base.state.canDelete) {
      CLI.log.error(Lang.BUILDIN.NO_THIS_FOLDER);
    } else {
      CLI.log.success(Lang.MSG_SUCCESS, Lang.BUILDIN.DELETE_COMMAND_FLOW_SUCCESS);
    }
    Wait.next();
  },
});
