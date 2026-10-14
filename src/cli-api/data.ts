export const Data = {
  /**
   * 将数组转换为 Set
   * @param arr 任意数组
   * @returns Set 对象
   */
  arrayToSet<T>(arr: T[]): Set<T> {
    return new Set(arr);
  },

  /**
   * 将 Set 转换为数组
   * @param set Set 对象
   * @returns 数组对象
   */
  setToArray<T>(set: Set<T>): T[] {
    return Array.from(set);
  },

  /**
   * 获取两个数组的差集 (arrA 中有但 arrB 中没有的元素)
   * @param arrA 数组 A
   * @param arrB 数组 B
   * @returns 差集数组
   */
  getDifferenceSet<T>(arrA: T[], arrB: T[]): T[] {
    const setA = new Set(arrA);
    const setB = new Set(arrB);
    const difference = new Set([...setA].filter(e => !setB.has(e)));

    return Array.from(difference);
  },

  /**
   * 获取两个数组的交集
   * @param arrA 数组 A
   * @param arrB 数组 B
   * @returns 交集数组
   */
  getIntersectionSet<T>(arrA: T[], arrB: T[]): T[] {
    const setA = new Set(arrA);
    const setB = new Set(arrB);
    const intersection = new Set([...setA].filter(e => setB.has(e)));

    return Array.from(intersection);
  },

  /**
   * 获取两个数组的并集（合并并去重）
   * @param arrA 数组 A
   * @param arrB 数组 B
   * @returns 并集数组
   */
  getUnionSet<T>(arrA: T[], arrB: T[]): T[] {
    const set = new Set([...arrA, ...arrB]);
    return Array.from(set);
  },

  /**
   * 获取数据的真实类型
   * @param data 任意数据
   * @returns 类型字符串 (如 String, Number, Boolean, Object 等)
   */
  getType(data: unknown): string {
    const temp = Object.prototype.toString.call(data);
    return temp.substring(8, temp.length - 1);
  },

  /**
   * 验证元素是否存在于数组中
   * @param element 目标元素
   * @param source 源数组
   * @returns 是否存在
   */
  hasElement<T>(element: T, source: T[]): boolean {
    let exist = false;

    for (const e in source) {
      if (source[e as unknown as keyof T[]] === element) {
        exist = true;
        break;
      }
    }

    return exist;
  },

  /**
   * 向数组中添加元素（若不存在则添加）
   * @param element 目标元素
   * @param source 源数组
   * @returns 更新后的数组
   */
  addElement<T>(element: T, source: T[]): T[] {
    const newArr = source;
    if (newArr.indexOf(element) === -1) {
      newArr.push(element);
    }

    return newArr;
  },

  /**
   * 数组排序（支持基础类型，或对象按指定唯一属性排序）
   * @param array 源数组
   * @param uniqueProp 对象用于排序的唯一属性名
   * @returns 排序后的数组
   */
  arraySort<T>(array: T[], uniqueProp?: keyof T): T[] {
    const res: T[] = [];
    const map = new Map<any, T>();

    array.forEach(item => {
      const type = Data.getType(item);
      if (type === 'Object' && uniqueProp !== undefined) {
        map.set(item[uniqueProp], item);
      } else {
        res.push(item);
        res.sort();
      }
    });

    if (map.size !== 0 && uniqueProp !== undefined) {
      const keys: any[] = [];
      for (const key of map.keys()) {
        keys.push(key);
      }
      keys.sort();
      const newCmds: T[] = [];
      keys.forEach(key => {
        for (const index in array) {
          const uniquePropVal = array[index][uniqueProp];
          if (uniquePropVal === key) {
            newCmds.push(array[index]);
            break;
          }
        }
      });
      return newCmds;
    } else {
      return res;
    }
  },
};

export default Data;
