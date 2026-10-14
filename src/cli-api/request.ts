import axios, {Method, AxiosRequestConfig} from 'axios';

/**
 * 请求结果接口
 */
export interface AjaxResult {
  status: 'success' | 'error';
  data: any;
}

export const Request = {
  /**
   * HTTP 请求方法
   * @param url 请求链接
   * @param method HTTP 请求方法 (如 GET, POST 等)
   * @param params 请求参数
   * @param headers 请求头
   * @param timeout 超时时间（毫秒）
   * @returns 返回包含状态和数据的 Promise 对象
   */
  ajax(
    url: string,
    method: Method | string,
    params?: any,
    headers?: Record<string, any>,
    timeout?: number,
  ): Promise<AjaxResult> {
    const config: AxiosRequestConfig = {
      url: url,
      method: method,
    };

    if (params) {
      config.data = params;
    }
    if (headers) {
      config.headers = headers;
    }

    axios.defaults.timeout = timeout ? timeout : 10000;

    return new Promise(resolve => {
      axios(config)
        .then(response => {
          if (response.status === 200) {
            resolve({
              status: 'success',
              data: response.data,
            });
          } else {
            resolve({
              status: 'error',
              data: response.data?.message || '未知错误',
            });
          }
        })
        .catch(error => {
          resolve({
            status: 'error',
            data: error.message,
          });
        });
    });
  },
};

export default Request;
