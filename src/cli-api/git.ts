import {spawn} from 'child_process';

/**
 * 命令执行结果接口
 */
export interface ExecResult {
  status: boolean;
  data: string;
}

/**
 * 最新提交记录接口
 */
export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

/**
 * 分支信息接口
 */
export interface BranchsResult {
  current: string;
  branchs: string[];
}

/**
 * 异步执行命令
 * @param cmd 命令
 * @param dir 运行命令的目录
 * @returns Promise 对象，包含执行状态与输出结果
 */
export function asyncExecute(cmd: string, dir: string = process.cwd()): Promise<ExecResult> {
  const volidateCmdFailed = (status: boolean, reason: string): ExecResult | undefined => {
    if (!status) {
      return {
        status: false,
        data: reason,
      };
    }
  };

  return new Promise(resolve => {
    const cp = spawn(cmd, {
      cwd: dir,
      stdio: 'pipe',
      shell: true,
    });
    let dataOk = '';
    let dataError = '';

    cp.stdout?.on('data', (data: Buffer) => {
      dataOk += data.toString().trim();
    });
    cp.stderr?.on('data', (data: Buffer) => {
      dataError += data.toString().trim();
    });

    cp.on('close', () => {
      let status = true;
      if (
        (dataOk.length === 0 && dataError.indexOf('error:') > -1) ||
        dataError.indexOf('fatal:') > -1
      ) {
        status = false;
      }

      const data = dataOk.length !== 0 ? dataOk : dataError;
      volidateCmdFailed(status, data);

      resolve({
        status,
        data,
      });
    });
  });
}

/**
 * 获取数据的精确类型
 * @param variable 任意变量
 * @returns 类型字符串
 */
export function getType(variable: unknown): string {
  let temp = Object.prototype.toString.call(variable);
  return temp.substring(8, temp.length - 1);
}

export const Git = {
  /**
   * 获取当前 Git 分支
   * @param cwd 运行命令的目录
   */
  async getCurrentBranch(cwd: string = process.cwd()): Promise<ExecResult> {
    const {data} = await asyncExecute('git rev-parse --abbrev-ref HEAD', cwd);
    return {
      status: true,
      data,
    };
  },

  /**
   * 获取当前的 Git 标签
   * @param cwd 运行命令的目录
   */
  async getCurrentTag(cwd: string = process.cwd()): Promise<ExecResult> {
    const {data, status} = await asyncExecute('git describe --tags', cwd);
    return {
      status,
      data,
    };
  },

  /**
   * 获取最近一次的提交记录
   * @param cwd 运行命令的目录
   */
  async getLatestCommit(cwd: string = process.cwd()): Promise<{status: boolean; data: CommitInfo}> {
    const cmd = `git log -1 --pretty=format:'{
        "hash": "%H",
        "author": "%an",
        "email": "%ae",
        "date": "%ad",
        "message": "%s"
      }'`;
    const {data, status} = await asyncExecute(cmd, cwd);
    return {
      status,
      data: JSON.parse(data),
    };
  },

  /**
   * 为当前项目通过 CLI 初始化 Git 用户信息
   * @param name Git 用户名
   * @param email Git 用户邮箱
   * @returns 本地 Git 用户账户信息对象
   */
  async initLocalUser(name: string, email: string): Promise<Record<string, string>> {
    let setName = `git config --local user.name "${name}"`;
    let setEmail = `git config --local user.email "${email}"`;
    await asyncExecute(setName);
    await asyncExecute(setEmail);

    const {data} = await asyncExecute('git config --local --list');
    let rows = data.split('\n');
    let local: Record<string, string> = {};
    rows.forEach(row => {
      let temp = row.split('=');
      if (temp.length >= 2) {
        local[temp[0]] = temp[1];
      }
    });
    return local;
  },

  /**
   * 获取所有的 Git 分支以及当前分支
   * @param cwd 运行命令的目录
   * @returns 所有分支及当前分支的对象
   */
  async getBranchs(cwd: string = process.cwd()): Promise<BranchsResult> {
    const cmd = 'git branch';
    let {data} = await asyncExecute(cmd, cwd);
    let branchs = data.split('\n');
    let current = branchs.find(branch => branch.indexOf('*') > -1) || '';

    return {
      current,
      branchs,
    };
  },

  /**
   * 切换 Git 分支
   * @param cwd 运行命令的目录
   * @param branch 分支名称
   */
  async checkout(cwd: string = process.cwd(), branch: string): Promise<ExecResult> {
    const cmd = `git checkout ${branch}`;
    const expect1 = `Your branch is up to date with 'origin/${branch}'.`;
    const expect2 = `Your branch is ahead of 'origin/${branch}'`;
    const expect3 = `Switched to a new branch '${branch}'`;
    const {data} = await asyncExecute(cmd, cwd);

    let realStatus = false;
    if (data.indexOf(expect1) >= 0 || data.indexOf(expect2) >= 0 || data.indexOf(expect3) >= 0) {
      realStatus = true;
    }

    return {
      status: realStatus,
      data,
    };
  },

  /**
   * 获取当前分支的状态
   * @param cwd 运行命令的目录
   * @returns 当前分支状态的字符串内容
   */
  async status(cwd: string = process.cwd()): Promise<ExecResult> {
    let cmd = 'git status';
    const {data} = await asyncExecute(cmd, cwd);
    let status = true;

    if (data.indexOf('use "git add" and/or "git commit -a"') > -1) {
      status = false;
    }
    return {
      status,
      data,
    };
  },

  /**
   * 在当前分支提交所有更改
   * @param cwd 运行命令的目录
   * @param msg 提交说明信息
   * @returns 提交分支状态的布尔值
   */
  async commit(cwd: string = process.cwd(), msg: string): Promise<ExecResult> {
    const comitCmd = `git commit -m "${msg}"`;
    const expect1 = 'use "git push"';
    const expect2 = 'nothing to commit';
    const expect3 = 'changed';
    const expect4 = 'insertions';
    const expect5 = 'deletions';

    await asyncExecute('git add .', cwd);
    const {data} = await asyncExecute(comitCmd, cwd);

    let realStatus = false;
    if (
      data.indexOf(expect1) >= 0 ||
      data.indexOf(expect2) >= 0 ||
      data.indexOf(expect3) >= 0 ||
      data.indexOf(expect4) >= 0 ||
      data.indexOf(expect5) >= 0
    ) {
      realStatus = true;
    }

    return {
      status: realStatus,
      data,
    };
  },

  /**
   * 拉取分支代码
   * @param cwd 运行命令的目录
   */
  async pull(cwd: string = process.cwd()): Promise<ExecResult> {
    const cmd = 'git pull';
    const expect1 = 'Already up to date.';

    let current = await Git.status(cwd);
    if (!current.status) {
      return {
        status: current.status,
        data: current.data,
      };
    }

    const {data} = await asyncExecute(cmd, cwd);
    let realStatus = data.indexOf(expect1) >= 0 ? true : false;

    return {
      status: realStatus,
      data,
    };
  },

  /**
   * 推送分支代码
   * @param cwd 运行命令的目录
   * @param isFource 是否强制推送
   */
  async push(cwd: string = process.cwd(), isFource: boolean = false): Promise<ExecResult> {
    let cmd = 'git push';

    if (isFource) cmd = 'git push -f';

    let current = await Git.status(cwd);
    if (!current.status) {
      return {
        status: current.status,
        data: current.data,
      };
    }

    const {status, data} = await asyncExecute(cmd, cwd);

    return {
      status,
      data,
    };
  },

  /**
   * 合并分支
   * @param cwd 运行命令的目录
   * @param branch 要合并的分支名
   */
  async merge(cwd: string = process.cwd(), branch: string): Promise<ExecResult> {
    const cmd = `git merge ${branch}`;
    const expect1 = `Merge made by the 'recursive' strategy`;
    const expect2 = `Already up to date`;
    const expect3 = `not something we can merge`;

    let current = await Git.status(cwd);
    if (!current.status) {
      return {
        status: current.status,
        data: current.data,
      };
    }

    const {data} = await asyncExecute(cmd, cwd);

    let realStatus = false;
    if (data.indexOf(expect1) >= 0 || data.indexOf(expect2) >= 0 || data.indexOf(expect3) >= 0) {
      realStatus = true;
    }

    return {
      status: realStatus,
      data,
    };
  },

  /**
   * 更新子模块
   * @param cwd 运行命令的目录
   */
  async updateSubmodule(cwd: string = process.cwd()): Promise<ExecResult> {
    const cmd = 'git submodule update --remote';
    const {data, status} = await asyncExecute(cmd, cwd);

    return {
      status: status,
      data: data,
    };
  },

  /**
   * 获取远程分支
   * @param cwd 运行命令的目录
   * @param branch 分支名称
   */
  async fetchOrigin(cwd: string = process.cwd(), branch: string): Promise<ExecResult> {
    const cmd = 'git fetch origin' + ' ' + branch;
    const {status, data} = await asyncExecute(cmd, cwd);
    return {
      status,
      data,
    };
  },

  /**
   * 变基操作
   * @param cwd 运行命令的目录
   * @param branch 分支名称
   */
  async rebaese(cwd: string = process.cwd(), branch: string): Promise<ExecResult> {
    const cmd = 'git rebase origin/' + branch;
    const {status, data} = await asyncExecute(cmd, cwd);

    return {
      status,
      data,
    };
  },

  /**
   * 删除分支
   * @param cwd 运行命令的目录
   * @param branch 分支名称
   */
  async deleteBranch(cwd: string = process.cwd(), branch: string): Promise<ExecResult> {
    const cmd = `git branch -D ${branch}`;
    const {data} = await asyncExecute(cmd, cwd);
    return {
      status: true,
      data: data,
    };
  },
};

export default {
  Git,
  asyncExecute,
};
