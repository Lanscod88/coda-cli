/**
 * 日期工具类
 */
export const BDate = {
  /**
   * 获取格式化后的日期字符串
   * @param date Date 对象
   * @returns 格式化后的日期字符串 (YYYY-MM-DD HH:mm:ss)
   */
  getFormatDate(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() >= 9 ? date.getMonth() + 1 : `0${date.getMonth() + 1}`;
    const day = date.getDate() > 9 ? date.getDate() : `0${date.getDate()}`;
    const hour = date.getHours() > 9 ? date.getHours() : `0${date.getHours()}`;
    const minute = date.getMinutes() > 9 ? date.getMinutes() : `0${date.getMinutes()}`;
    const second = date.getSeconds() > 9 ? date.getSeconds() : `0${date.getSeconds()}`;

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },
};

export default BDate;
