import { promiseTimeout } from '@superset-ui/core/src';

describe('promiseTimeout(func, delay)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves after delay', async () => {
    const promise = promiseTimeout(() => 'abcd', 10);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual('abcd');
    expect(result).toHaveLength(4);
  });

  it('uses the timer', async () => {
    const promise = Promise.race([
      promiseTimeout(() => 'abc', 10),
      promiseTimeout(() => 'def', 20),
    ]);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual('abc');
  });
});
