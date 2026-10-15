import {MCPToolDefinition} from '../types';
import {fileToolDefinitions, FileMCPExecutor} from './fileTools';

export class ToolRegistry {
  private tools: Map<
    string,
    {definition: MCPToolDefinition; executor: (args: any) => Promise<string>}
  > = new Map();

  constructor(private fileExecutor: FileMCPExecutor) {
    // 默认自动注册内置的文件操作工具
    this.registerBuiltinTools();
  }

  /**
   * 注册内置工具（如文件读写、目录浏览等）
   */
  private registerBuiltinTools() {
    for (const def of fileToolDefinitions) {
      this.registerTool(def, async args => {
        return await this.fileExecutor.execute(def.name, args);
      });
    }
  }

  /**
   * 注册一个新工具
   */
  public registerTool(definition: MCPToolDefinition, executor: (args: any) => Promise<string>) {
    this.tools.set(definition.name, {definition, executor});
  }

  /**
   * 获取所有已注册工具的定义（可用于拼接 System Prompt 或对接 OpenAI/Ollama 的 Tools 规范）
   */
  public getDefinitions(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * 根据工具名称和参数执行对应的工具
   */
  public async execute(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `错误：未找到名为 "${name}" 的工具。请检查工具名称是否正确。`;
    }

    try {
      return await tool.executor(args);
    } catch (err: any) {
      return `执行工具 "${name}" 失败: ${err.message}`;
    }
  }
}
