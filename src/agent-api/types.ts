export interface AISettings {
  protocol: 'ollama' | 'openai'; // 模型服务协议
  baseUrl: string; // 服务地址
  apiKey?: string; // API密钥
  model: string; // 模型名称（或多模型模式下的代码实现模型）
  options: {
    contextSize: number; // 上下文大小
    architectureModel?: string; // 架构设计模型（多模型协作专用）
    [key: string]: any;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {type: string; description: string}>;
    required?: string[];
  };
}

export interface ToolCallRequest {
  name: string;
  arguments: any;
}
