import * as fs from 'fs';
import * as path from 'path';
import {request} from '@/cli-api';
import {AISettings} from '@/agent-api/types';
import {CLI} from '@/cli-core';

/**
 * 获取 code-agent 的根目录，优先从环境变量获取，兜底使用当前工作目录
 */
export const getCliRoot = (): string => process.env.cliRoootPath || process.cwd();

/**
 * 获取配置文件路径
 */
export const getConfigPath = (): string =>
  path.join(getCliRoot(), 'src', 'config', 'commands.json');

/**
 * 计算字符串在终端中的实际显示宽度（中文字符算 2 个宽度，英文算 1 个）
 */
export const getDisplayWidth = (str: string): number => {
  let width = 0;
  for (const char of str) {
    if (char.charCodeAt(0) > 127) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

/**
 * 根据实际显示宽度进行右侧填充对齐
 */
export const padEndDisplay = (str: string, targetWidth: number): string => {
  const currentWidth = getDisplayWidth(str);
  const diff = targetWidth - currentWidth;
  return str + ' '.repeat(Math.max(0, diff));
};

/**
 * 通用终端动态表格打印函数（支持跨列标题、长标题自适应与连续边框）
 */
export const printTerminalTable = (title: string, headers: string[], rows: string[][]): void => {
  const numCols = headers.length;

  const colWidths: number[] = headers.map((header, colIndex) => {
    const maxLen = Math.max(
      getDisplayWidth(header),
      ...rows.map(row => getDisplayWidth(row[colIndex] || '')),
    );
    return maxLen + 2;
  });

  let totalInnerWidth = colWidths.reduce((sum, w) => sum + w, 0) + (numCols - 1);

  const paddedTitleText = ` ${title} `;
  const paddedTitleW = getDisplayWidth(paddedTitleText);
  if (paddedTitleW > totalInnerWidth) {
    const diff = paddedTitleW - totalInnerWidth;
    colWidths[colWidths.length - 1] += diff;
    totalInnerWidth = paddedTitleW;
  }

  const topBorder = `┌${'─'.repeat(totalInnerWidth)}┐`;
  const titleSeparator = `├${colWidths.map(w => '─'.repeat(w)).join('┬')}┤`;
  const midBorder = `├${colWidths.map(w => '─'.repeat(w)).join('┼')}┤`;
  const btmBorder = `└${colWidths.map(w => '─'.repeat(w)).join('┴')}┘`;

  const leftPad = Math.floor((totalInnerWidth - paddedTitleW) / 2);
  const rightPad = totalInnerWidth - paddedTitleW - leftPad;
  const finalTitleLine =
    ' '.repeat(Math.max(0, leftPad)) + paddedTitleText + ' '.repeat(Math.max(0, rightPad));

  CLI.log.info('');
  CLI.log.info(topBorder);
  CLI.log.info(`│${finalTitleLine}│`);
  CLI.log.info(titleSeparator);

  const headerStr = headers.map((h, i) => padEndDisplay(h, colWidths[i])).join('│');
  CLI.log.info(`│${headerStr}│`);
  CLI.log.info(midBorder);

  rows.forEach(row => {
    const rowStr = row.map((cell, i) => padEndDisplay(cell || '', colWidths[i])).join('│');
    CLI.log.info(`│${rowStr}│`);
  });

  CLI.log.info(btmBorder + '\n');
};

/**
 * 通用模型服务连通性校验函数
 */
export async function verifyService(
  baseUrl: string,
  protocol: string,
  apiKey?: string,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey && protocol !== 'ollama') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const testUrl = protocol === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
    const response: any = await request.ajax(testUrl, 'get', {headers});

    if (response && response.status !== 'error') {
      return true;
    }
  } catch (e: any) {}
  return false;
}

/**
 * 加载本地保存的 AI 配置
 */
export function loadSavedConfig(): AISettings | null {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(raw);
      const setting: AISettings = data.aiSetting;
      if (setting && setting.protocol && setting.baseUrl && setting.model && setting.options) {
        if (
          setting.protocol.length !== 0 &&
          setting.baseUrl.length !== 0 &&
          setting.model.length !== 0 &&
          setting.options.contextSize > 0
        ) {
          return setting;
        }
        return null;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * 保存 AI 配置到 commands.json
 */
export function saveConfig(settings: AISettings) {
  try {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
    let existing: any = {};
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    existing.aiSetting = settings;
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch (e) {}
}

/**
 * 解析用户输入的模型
 */
export function parseModelInput(inputStr: string, modelList: string[]): string {
  const trimmed = inputStr.trim();
  const num = Number(trimmed);
  if (!isNaN(num) && num >= 1 && num <= modelList.length) {
    return modelList[num - 1];
  }
  return trimmed || modelList[0];
}
