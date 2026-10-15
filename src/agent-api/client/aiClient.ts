import {AISettings, ChatMessage} from '../types';

export class AIClient {
  constructor(private settings: AISettings) {}

  /**
   * 调用 AI 模型进行对话（支持流式回调）
   */
  public async chat(messages: ChatMessage[], onChunk?: (chunk: string) => void): Promise<string> {
    const host = (this.settings.baseUrl || 'http://127.0.0.1:11434')
      .replace('localhost', '127.0.0.1')
      .replace(/\/$/, '');

    const targetUrl =
      this.settings.protocol === 'ollama' ? `${host}/api/chat` : `${host}/chat/completions`;

    const body =
      this.settings.protocol === 'ollama'
        ? {
            model: this.settings.model,
            messages: messages,
            stream: !!onChunk,
            options: {num_ctx: this.settings.options.contextSize || 32768},
          }
        : {
            model: this.settings.model,
            messages: messages,
            stream: !!onChunk,
          };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.settings.apiKey ? {Authorization: `Bearer ${this.settings.apiKey}`} : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`AI 服务响应错误: 状态码 ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          // 适配 Ollama 与 OpenAI 的 Chunk 结构
          const chunk = json.message?.content || json.choices?.[0]?.delta?.content || '';
          if (chunk) {
            fullText += chunk;
            if (onChunk) onChunk(chunk);
          }
        } catch (e) {}
      }
    }

    return fullText;
  }
}
