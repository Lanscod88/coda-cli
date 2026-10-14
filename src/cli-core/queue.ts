/**
 * 定义任务函数类型
 */
type Task = () => void;

export function queue() {
  const tasks: Task[] = [];
  const layzs: Task[] = [];

  const dequeue = (): void => {
    let current = tasks.shift();
    if (current) {
      current();
    }
  };

  /**
   * 将任务加入延迟队列
   */
  const dequeueLayz = (): void => {
    if (layzs.length === 0) {
      return;
    }
    let current = layzs.shift();
    if (current) {
      current();
    }
  };

  /**
   * 将任务加入队列
   * @param task 任务函数
   * @param layz 是否为延迟执行任务
   */
  const enqueue = (task: Task, layz?: boolean): void => {
    if (!layz) {
      tasks.push(task);
    } else {
      layzs.push(task);
    }
  };

  /**
   * 通知下一个任务并执行出队
   * @param nextLayz 下一个任务是否为延迟执行
   */
  const next = (nextLayz?: boolean): void => {
    if (tasks.length === 0) {
      dequeueLayz();
      return;
    }
    if (nextLayz) {
      let nextTask = tasks.shift();
      if (nextTask) {
        layzs.unshift(nextTask);
      }
    }

    dequeue();
  };

  return {
    enqueue,
    next,
  };
}

export default queue;
