import * as path from 'path';
import * as fs from 'fs';
import {Lang} from './lang';

export const Util = {
  /**
   * 验证文件名
   * @param input 输入的文件名
   * @returns 验证通过返回 true，否则返回错误提示字符串
   */
  volidateFileName(input: string): true | string {
    if (/\s/.test(input)) {
      return Lang.BUILDIN.NAME_NO_WHITESPACE;
    }

    if (/[A-Z]/.test(input)) {
      return Lang.BUILDIN.NAME_LOWERCASE;
    }

    const regex = /[\s~`!@#$%^&*()\_=+[\]{}|;:'",<.>/?]/; // 只允许使用 - 作为文件名分隔符
    if (regex.test(input)) {
      return Lang.BUILDIN.NAME_NO_SPECIAL_CHARACTER;
    }

    return true;
  },

  /**
   * 验证路径是否存在及合法性
   * @param input 输入的文件名
   * @param root 根目录路径
   * @returns 验证通过返回 true，否则返回错误提示字符串
   */
  validatePath(input: string, root: string): true | string {
    const commonValidate = Util.volidateFileName(input);

    if (commonValidate === true) {
      const tempPath = path.join(root, input);
      if (fs.existsSync(tempPath)) {
        return `${input} ${Lang.BUILDIN.EXSITED}`;
      } else {
        return true;
      }
    } else {
      return commonValidate;
    }
  },

  /**
   * 将中划线命名转换为驼峰命名 (camelCase)
   * @param input 输入的字符串
   */
  convertWordsToHump(input: string): string {
    let text = '';
    const index = input.indexOf('-');

    if (index > -1) {
      input.split('-').forEach((item, index) => {
        if (index === 0) {
          text = item;
        } else {
          const newText = item.charAt(0).toUpperCase() + item.slice(1);
          text += newText;
        }
      });
    } else {
      text = input;
    }

    return text;
  },

  /**
   * 将中划线命名转换为大驼峰/类名命名 (PascalCase)
   * @param input 输入的字符串
   */
  convertWordsToClassname(input: string): string {
    let text = '';
    const index = input.indexOf('-');

    if (index > -1) {
      input.split('-').forEach(item => {
        text += item.charAt(0).toUpperCase() + item.slice(1);
      });
    } else {
      text = input.charAt(0).toUpperCase() + input.slice(1);
    }

    return text;
  },
};
