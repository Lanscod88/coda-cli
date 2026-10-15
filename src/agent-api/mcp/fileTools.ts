import * as fs from 'fs';
import * as path from 'path';
import {MCPToolDefinition} from '../types';

export const fileToolDefinitions: MCPToolDefinition[] = [
  {
    name: 'list_directory',
    description: '列出指定目录下的文件和文件夹',
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: '相对工作区路径，空字符串表示根目录'},
      },
    },
  },
  {
    name: 'read_file',
    description: '读取指定文件的文本内容',
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: '文件相对路径'},
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '向指定文件写入或创建内容',
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: '文件相对路径'},
        content: {type: 'string', description: '要写入的完整文本内容'},
      },
      required: ['path', 'content'],
    },
  },
];

export class FileMCPExecutor {
  constructor(private getWorkspaceRoot: () => string) {}

  private resolvePath(targetPath: string): string {
    const root = this.getWorkspaceRoot();
    if (!targetPath) return root;
    return path.isAbsolute(targetPath) ? targetPath : path.join(root, targetPath);
  }

  public async execute(name: string, args: any): Promise<string> {
    const root = this.getWorkspaceRoot();
    if (!root) return '错误：未指定工作区根目录。';

    try {
      if (name === 'list_directory') {
        const targetPath = this.resolvePath(args.path || '');
        const entries = await fs.promises.readdir(targetPath, {withFileTypes: true});
        const list = entries.map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`);
        return JSON.stringify(list, null, 2);
      }

      if (name === 'read_file') {
        if (!args.path) return '错误：read_file 缺少 path 参数';
        const filePath = this.resolvePath(args.path);
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) return `错误："${args.path}" 是一个目录而不是文件。`;
        return await fs.promises.readFile(filePath, 'utf8');
      }

      if (name === 'write_file') {
        if (!args.path) return '错误：write_file 缺少 path 参数';
        const filePath = this.resolvePath(args.path);
        const dir = path.dirname(filePath);
        await fs.promises.mkdir(dir, {recursive: true});
        await fs.promises.writeFile(filePath, args.content || '', 'utf8');
        return `成功：文件 ${args.path} 已写入。`;
      }

      return `未知工具: ${name}`;
    } catch (err: any) {
      return `执行工具 ${name} 失败: ${err.message}`;
    }
  }
}
