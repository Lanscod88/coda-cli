import ncu from 'npm-check-updates';
import semver from 'semver';
import Request from './request';

/**
 * 版本检查结果接口
 */
export interface VersionInfo {
  name?: string;
  version?: string;
}

export const Packages = {
  /**
   * 更新 npm 包
   * @param path package.json 文件路径
   * @param reject 排除不需要更新的包（支持字符串或字符串数组）
   * @returns 返回更新后的依赖配置对象
   */
  async update(path: string, reject?: string | string[]): Promise<any> {
    const upgraded = await ncu({
      packageFile: path,
      upgrade: true,
      install: 'always',
      reject: reject,
    });

    return upgraded;
  },

  /**
   * 检查 CLI 版本
   * @param url CLI 发布的仓库/地址
   * @param localVersion 安装在 npm 全局目录下的本地 CLI 版本
   * @returns 若有新版本则返回包含名称和新版本号的对象，否则返回空对象
   */
  async checkVersion(url: string, localVersion: string): Promise<VersionInfo> {
    let response = await Request.ajax(url, 'get');
    if (response.status === 'success') {
      let remoteVersion = response.data['version']
        ? response.data['version']
        : response.data['dist-tags']['latest'];
      let res = semver.lt(localVersion, remoteVersion);
      if (res) {
        return {
          name: response.data.name,
          version: remoteVersion,
        };
      } else {
        return {};
      }
    } else {
      return {};
    }
  },

  /**
   * 查询 npm 包的最新版本
   * @param url npm 仓库地址
   * @param defaultVersion 网络错误时使用的默认版本号
   * @returns 返回版本号字符串
   */
  async getLatestVersion(url: string, defaultVersion: string): Promise<string> {
    let data = await Request.ajax(url, 'get');
    if (data.status === 'success') {
      return data.data['version'];
    } else {
      return defaultVersion;
    }
  },
};

export default Packages;
