import { Disposable } from '@apache-superset/primitives';

// Export an object what contains a commands key and a registerCommand function
export const commands = {
  registerCommand(
    command: string,
    callback: (...args: any[]) => any,
    thisArg?: any,
  ): Disposable {
    console.log('registering command', command);
    return new Disposable(() => {
      console.log('disposing command', command);
    });
  },
};

export const sqlLab = {
  databases: [
    {
      name: 'database1',
    },
    {
      name: 'database2',
    },
    {
      name: 'database3',
    },
  ],
};
