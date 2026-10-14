import cli from './cli';
import queue from './queue';
import {childProcess as ChildProcess} from '../cli-api';
import {Subscribe, Publish} from './watcher';
import {Lang} from '../service/lang';

/**
 * 生命周期任务函数类型
 */
type LifecycleTask = () => void;

/**
 * 运行时生命周期配置接口
 */
type RuntimeLifecycle = Partial<Record<string, LifecycleTask>>;

// 默认的生命周期阶段数组
const defaultLifecycle = ['init', 'prompt', 'default', 'writing', 'install', 'end'];

const Wait = queue();
const CLI = cli();

// 开始显示核心启动加载提示
CLI.loading.start(Lang.BUILDIN.CORE_STRTUP);

const Base = {
  // 状态对象
  state: {} as Record<string, any>,

  /**
   * 扩展并注册运行时生命周期任务
   * @param runtimeLifecycle 运行时生命周期对象
   */
  extends(runtimeLifecycle: RuntimeLifecycle): void {
    defaultLifecycle.forEach(task => {
      if (Object.prototype.hasOwnProperty.call(runtimeLifecycle, task)) {
        const taskFn = runtimeLifecycle[task];
        if (taskFn) {
          Wait.enqueue(taskFn);
        }
      }
    });

    CLI.loading.succeed(Lang.BUILDIN.CORE_STRTUP_DONE);
    Wait.next();
  },
};

export {Base, Wait, CLI, ChildProcess, Subscribe, Publish};

export default {
  Base,
  Wait,
  CLI,
  ChildProcess,
  Subscribe,
  Publish,
};
