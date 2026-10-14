/**
 * 命令项接口
 */
export interface CommandItem {
  command: string; //命令名称
  description: string; //命令描述
  custom: boolean; //是否是用户扩展的命令
}

/**
 * CLI 配置文件接口
 */
export interface CLIConfigType {
  packageName: string; //工具名称
  wordsLen: number; //命令单词数目
  name: string; //命令开头的单词
  commands: CommandItem[]; //全部命令
  inAnyPath: string[]; //能在任何路径执行的命令
  buildIn: string[]; //工具内置的命令
  store: string; //npm仓库地址
}

/**
 * 相似命令检查结果接口
 */
export interface LikeCommandResult {
  exsited: boolean;
  likeList: CommandItem[];
}
