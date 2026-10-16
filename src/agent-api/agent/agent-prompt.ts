/**
 * 根据运行模式生成 AI 系统提示词
 */
export function getSystemPrompt(
  enableMultiModel: boolean,
  architectureModel?: string,
  implementationModel?: string,
  taskMode?: 'coding' | 'review',
): string {
  let systemPrompt =
    '你是一个专业的命令行编程助手，可以通过 MCP 工具完成文件读写、目录查看与项目分析。\n\n' +
    '【核心行为准则】：\n' +
    '1. **概念、语法与理论问题**：请直接通过纯文本回答用户，绝对不要调用任何工具。\n' +
    '2. **项目实操任务**：必须严格通过工具调用（Tool Call）来执行。';

  if (enableMultiModel) {
    systemPrompt =
      `你是一个多模型协作编程助手（架构设计模型: ${architectureModel} 负责顶层规划，代码实现模型: ${implementationModel} 负责具体编码）。\n` +
      '【核心行为准则】：对于项目实操任务，必须通过 MCP 工具来实际完成文件的读写与修改。';
  } else if (taskMode === 'review') {
    systemPrompt =
      '你是一个资深的代码审查专家，负责对项目代码进行安全、性能和规范性审查。\n' +
      '【核心行为准则】：必须通过 MCP 工具去实际读取和检查相关项目文件。';
  }

  return systemPrompt;
}
