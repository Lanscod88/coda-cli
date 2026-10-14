import * as nodeFS from 'fs';
import * as nodePath from 'path';
import * as glob from 'glob';
import fsExtra from 'fs-extra';

export const FS = {
  /**
   * 获取目标根路径
   * @returns 返回路径字符串
   */
  processRoot(): string {
    return process.cwd();
  },

  /**
   * 拼接路径
   * @param paths 路径名称
   * @returns 返回拼接后的路径字符串
   */
  join(...paths: string[]): string {
    return nodePath.join(...paths);
  },

  /**
   * 获取绝对路径
   * @param paths 路径名称
   * @returns 返回绝对路径字符串
   */
  resolve(...paths: string[]): string {
    return nodePath.resolve(...paths);
  },

  /**
   * 获取相对路径
   * @param rootpath 根路径
   * @param pathNames 目标路径名称
   * @returns 返回相对路径字符串
   */
  relative(rootpath: string, pathNames: string): string {
    return nodePath.relative(rootpath, pathNames);
  },

  /**
   * 验证路径是否为绝对路径
   * @param filePath 文件路径
   * @returns 是否为绝对路径
   */
  isAbsolutePath(filePath: string): boolean {
    return nodePath.isAbsolute(filePath);
  },

  /**
   * 验证路径是否存在
   * @param path 路径名称
   * @returns 是否存在
   */
  hasPath(path: string): boolean {
    return nodeFS.existsSync(path);
  },

  /**
   * 获取文件名（基本名）
   * @param filePath 文件路径
   * @param ext 后缀名
   * @returns 文件名字符串
   */
  baseName(filePath: string, ext?: string): string {
    return nodePath.basename(filePath, ext);
  },

  /**
   * 通过分隔符拆分文件路径并获取指定部分
   * @param filePath 文件路径
   * @param splitStr 用于拆分文件路径的分隔符
   * @returns 拆分后的字符串
   */
  splitFileName(filePath: string, splitStr: string): string {
    return filePath.split(splitStr)[1];
  },

  /**
   * 获取 Windows 或 Linux 系统的路径分隔符
   * @returns 路径分隔符字符串
   */
  getSlash(): string {
    if (process.platform === 'win32') {
      return '\\';
    } else {
      return '/';
    }
  },

  /**
   * 根据匹配模式获取所有文件
   * @param pattern 匹配模式字符串
   * @returns 文件路径数组
   */
  getFiles(pattern: string): string[] {
    let files: string[] = [];
    let resource = glob.sync(pattern, {dot: true});
    resource.forEach((item: string) => {
      if (nodeFS.statSync(item).isFile()) {
        files.push(item);
      }
    });
    return files;
  },

  /**
   * 批量删除不同目录下的文件（不能删除文件夹）
   * @param files 包含文件路径的数组
   * @param fn 错误回调函数
   */
  deleteFiles(files: string[], fn?: (err: NodeJS.ErrnoException | null) => void): void {
    files.forEach(file => {
      nodeFS.unlink(file, err => {
        if (err && fn) {
          fn(err);
        }
      });
    });
  },

  /**
   * 删除文件夹及其内部文件
   * @param folder 文件夹路径名称
   * @param sync 是否需要同步执行
   */
  deleteFolder(folder: string, sync?: boolean): void {
    const del = require('del');
    if (sync) {
      del.sync(folder, {force: true});
    } else {
      del(folder, {force: true});
    }
  },

  /**
   * 复制文件
   * @param path 源文件路径
   * @param targetPath 目标文件路径
   * @param opt 复制选项或过滤函数
   */
  copyFile(path: string, targetPath: string, opt?: fsExtra.CopySyncOptions): void {
    if (opt) {
      fsExtra.copySync(path, targetPath, opt);
    } else {
      fsExtra.copySync(path, targetPath);
    }
  },

  /**
   * 创建文件夹
   * @param dir 路径名称
   */
  createFloder(dir: string): void {
    fsExtra.ensureDirSync(dir);
  },

  /**
   * 创建空文件
   * @param filePath 文件路径名称
   * @param fn 回调函数
   */
  createFile(filePath: string, fn?: (filePath: string) => void): void {
    fsExtra.ensureFileSync(filePath);
    if (fn) {
      fn(filePath);
    }
  },

  /**
   * 从文件中读取内容
   * @param filePath 文件路径
   * @param isJSON 是否解析为 JSON
   * @returns 字符串或 JSON 对象
   */
  readFile(filePath: string, isJSON?: boolean): any {
    let content: any;
    let data = nodeFS.readFileSync(filePath, {
      encoding: 'utf-8',
    });

    if (isJSON) {
      if (data.length === 0) {
        return {};
      }
      content = JSON.parse(data);
    } else {
      if (data.length === 0) {
        return '';
      }
      content = data;
    }

    return content;
  },

  /**
   * 将内容写入文件
   * @param filePath 文件路径
   * @param fileContent 字符串或 JSON 内容
   * @param isJSON 是否为 JSON 格式
   */
  writeFile(filePath: string, fileContent: any, isJSON?: boolean): void {
    let data = isJSON ? JSON.stringify(fileContent, null, 2) : fileContent;
    nodeFS.writeFileSync(filePath, data, {
      encoding: 'utf-8',
    });
  },
};

export default FS;
