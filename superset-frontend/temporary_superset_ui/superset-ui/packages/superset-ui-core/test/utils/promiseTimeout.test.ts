import { promiseTimeout } from '../../src';

describe('promiseTimeout(func, delay)', () => {
  it('resolves after delay', async () => {
    const result = await promiseTimeout(() => 'abc', 10);
    expect(result).toEqual('abc');
  });
  it('uses the timer', async () => {
    const result = await Promise.race([
      promiseTimeout(() => 'abc', 10),
      promiseTimeout(() => 'def', 20),
    ]);
    expect(result).toEqual('abc');
  });
});
