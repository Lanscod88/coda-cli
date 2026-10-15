import {AIClient} from '../client/aiClient';
import {ToolRegistry} from '../mcp/toolRegistry';
import {ChatMessage} from '../types';

export class AgentExecutor {
  constructor(
    private aiClient: AIClient,
    private toolRegistry: ToolRegistry,
    private maxSteps: number = 6, // 最大工具调用循环轮数，防止死循环
  ) {}

  /**
   * 鲁棒性 JSON 工具提取器（从大模型输出中精准提取工具调用 JSON）
   */
  private extractToolJson(text: string): string | null {
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const jsonStr = this.findValidJson(match[1].trim());
      if (jsonStr) return jsonStr;
    }
    return this.findValidJson(text);
  }

  private findValidJson(text: string): string | null {
    let start = text.indexOf('{');
    while (start !== -1) {
      let braces = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') {
          inStr = !inStr;
          continue;
        }
        if (!inStr) {
          if (c === '{') braces++;
          else if (c === '}') {
            braces--;
            if (braces === 0) {
              const candidate = text.substring(start, i + 1);
              try {
                const parsed = JSON.parse(candidate);
                // 兼容带 name 或 tool 字段的工具调用结构
                if (parsed && (parsed.name || parsed.tool)) {
                  if (!parsed.name && parsed.tool) parsed.name = parsed.tool;
                  return JSON.stringify(parsed);
                }
              } catch (e) {}
              break;
            }
          }
        }
      }
      start = text.indexOf('{', start + 1);
    }
    return null;
  }

  /**
   * 运行 Agent 任务
   * @param userPrompt 用户输入的任务需求
   * @param systemPrompt 系统提示词（包含工具说明）
   * @param onChunk 流式输出回调（用于实时打印到终端或 VS Code 界面）
   * @param onToolCall 工具执行时的回调通知（可选）
   */
  public async run(
    userPrompt: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void,
  ): Promise<string> {
    // 1. 初始化对话历史
    const messages: ChatMessage[] = [];

    // 如果有系统提示词，先加入。同时把注册的工具定义动态拼接进 System Prompt 中让模型知晓
    const toolDefs = this.toolRegistry.getDefinitions();
    const toolsDesc = toolDefs
      .map(t => `- ${t.name}: ${t.description} (参数: ${JSON.stringify(t.parameters)})`)
      .join('\n');

    const fullSystemPrompt = `${systemPrompt || '你是一个专业的 AI 编程助手，可以通过 JSON 调用工具完成任务。'}\n\n可用工具列表：\n${toolsDesc}\n\n当需要调用工具时，请输出标准的 JSON 块。`;

    messages.push({role: 'system', content: fullSystemPrompt});
    messages.push({role: 'user', content: userPrompt});

    let finalResponse = '';
    let steps = 0;

    // 2. 进入 ReAct 循环
    while (steps < this.maxSteps) {
      steps++;

      // 调用大模型（支持流式响应）
      const resText = await this.aiClient.chat(messages, chunk => {
        if (onChunk) onChunk(chunk);
      });

      finalResponse = resText;
      messages.push({role: 'assistant', content: resText});

      // 3. 检查模型是否请求了工具调用
      const toolJsonStr = this.extractToolJson(resText);
      if (!toolJsonStr) {
        // 模型没有调用工具，说明任务完成或只需普通回答，直接跳出循环
        break;
      }

      try {
        const toolCall = JSON.parse(toolJsonStr);
        const toolName = toolCall.name;
        const toolArgs = toolCall.arguments || toolCall.args || {};

        if (onToolCall) {
          onToolCall(toolName, toolArgs);
        } else if (onChunk) {
          onChunk(`\n\n⚙️ **正在执行工具 [${toolName}]**...\n`);
        }

        // 4. 执行工具
        const toolResult = await this.toolRegistry.execute(toolName, toolArgs);

        if (onChunk) {
          onChunk(`📥 **工具返回结果**:\n\`\`\`\n${toolResult.slice(0, 500)}\n\`\`\`\n\n`);
        }

        // 5. 将工具执行结果作为消息追加，进入下一轮循环让模型继续处理
        messages.push({
          role: 'user',
          content: `[MCP 工具 "${toolName}" 执行结果]:\n${toolResult}`,
        });
      } catch (err: any) {
        messages.push({
          role: 'user',
          content: `[系统错误]: 解析或执行工具失败: ${err.message}`,
        });
      }
    }

    return finalResponse;
  }
}
