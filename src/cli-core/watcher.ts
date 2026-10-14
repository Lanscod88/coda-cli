import {EventEmitter} from 'events';

// 创建全局事件发射器实例
const emitter = new EventEmitter();

/**
 * 订阅指定通道的事件
 * @template T 消息数据类型
 * @param channel 通道/事件名称
 * @param fn 收到消息时的回调函数
 */
export function Subscribe<T = any>(channel: string, fn: (message: T) => void): void {
  emitter.on(channel, (message: T) => {
    fn(message);
  });
}

/**
 * 向指定通道发布事件消息
 * @template T 消息数据类型
 * @param channel 通道/事件名称
 * @param message 要发送的消息内容
 */
export function Publish<T = any>(channel: string, message: T): void {
  emitter.emit(channel, message);
}

export default {
  Subscribe,
  Publish,
};
