import {Base, Wait, CLI, ChildProcess} from '@/cli-core';
import * as API from '@/cli-api';
import inquirer, {Answers, PromptSession} from 'inquirer';

Base.extends({
  init(): void {
    Base.state = {
      // TODO: 定义全局状态和方法
    };

    CLI.log.debug('run step 1: init done');
    Wait.next();
  },

  async prompt(): Promise<void> {
    const questions: any[] = [];
    const answers: Answers = await CLI.addQuestions(questions);
    // TODO: 通过 "answers" 设置全局状态值
    CLI.log.debug('run step 2: prompt done');
    Wait.next();
  },

  async default(): Promise<void> {
    // TODO: 处理一些需要计算的流程
    CLI.log.debug('run step 3: default done');
    Wait.next();
  },

  async writing(): Promise<void> {
    // TODO: 编写文件
    CLI.log.debug('run step 4: writing done');
    Wait.next();
  },

  async install(): Promise<void> {
    // TODO: 从 NPM 安装所需的库
    CLI.log.debug('run step 5: install done');
    Wait.next();
  },

  end(): void {
    // TODO: 显示此命令执行成功的消息
    CLI.log.debug('run step 6: end done');
    Wait.next();
  },
});
