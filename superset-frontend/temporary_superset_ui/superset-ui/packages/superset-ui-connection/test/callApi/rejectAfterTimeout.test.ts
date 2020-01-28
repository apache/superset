/* eslint promise/no-callback-in-promise: 'off' */
import rejectAfterTimeout from '../../src/callApi/rejectAfterTimeout';
import throwIfCalled from '../utils/throwIfCalled';

describe('rejectAfterTimeout()', () => {
  it('returns a promise that rejects after the specified timeout', done => {
    expect.assertions(1);
    jest.useFakeTimers();

    rejectAfterTimeout(10)
      .then(throwIfCalled)
      .catch(error => {
        expect(error).toBeDefined();

        return done();
      });

    jest.advanceTimersByTime(11);
    jest.useRealTimers();
  });
});
