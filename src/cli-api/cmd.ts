import {spawn, spawnSync} from 'child_process';

/**
 * 异步命令执行结果接口
 */
export interface CmdResult {
  status: 'success' | 'error';
  data: string;
}

export const childProcess = {
  /**
   * 执行命令
   * @param cmd 命令
   * @param dir 运行命令的目录
   * @param showOutput 是否在控制台打印标准输出
   */
  cmdExecute(cmd: string, dir: string = process.cwd(), showOutput: boolean = false): void {
    spawn(cmd, {
      cwd: dir,
      stdio: showOutput === true ? 'inherit' : 'pipe',
      shell: true,
    });
  },

  /**
   * 执行命令并返回异步结果
   * @param cmd 命令
   * @param dir 运行命令的目录
   * @returns Promise 对象
   */
  asyncCmdExecuteResult(cmd: string, dir: string = process.cwd()): Promise<CmdResult> {
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
        resolve({
          status: dataOk.length !== 0 ? 'success' : 'error',
          data: dataOk.length !== 0 ? dataOk : dataError,
        });
      });
    });
  },

  /**
   * 执行命令并同步返回结果
   * @param cmd 命令
   * @param dir 运行命令的目录
   * @returns 执行结果字符串
   */
  syncCmdExecuteResult(cmd: string, dir: string = process.cwd()): string {
    const cp = spawnSync(cmd, {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: true,
    });

    // 安全处理标准输出或错误输出，避免空指针异常
    const message = cp.stdout && cp.stdout.length > 0 ? cp.stdout : cp.stderr || '';
    return message.toString().trim();
  },

  /**
   * 在新的控制台窗口中执行任务
   * @param task 命令
   * @param dir 运行命令的目录
   * @param autoClose 执行完毕后控制台窗口是否自动关闭
   */
  taskInNewWindow(task: string, dir: string, autoClose: boolean): void {
    let cmd = autoClose ? `cmd /c ${task}` : `cmd /k ${task}`;

    if (process.platform !== 'win32') {
      cmd = `gnome-terminal -e 'bash -c "${task}; exec bash"'`;
    }

    spawn(cmd, {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      detached: true,
      windowsHide: true,
    });

    process.exit(0);
  },
};

export default childProcess;
