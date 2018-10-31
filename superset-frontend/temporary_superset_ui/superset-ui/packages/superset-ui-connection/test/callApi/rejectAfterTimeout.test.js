/* eslint promise/no-callback-in-promise: 'off' */
import rejectAfterTimeout from '../../src/callApi/rejectAfterTimeout';
import throwIfCalled from '../utils/throwIfCalled';

describe('rejectAfterTimeout()', () => {
  it('returns a promise that rejects after the specified timeout', done => {
    expect.assertions(1);
    jest.useFakeTimers();

    rejectAfterTimeout(10)
      .then(throwIfCalled)
      .catch(() => {
        expect(setTimeout).toHaveBeenCalledTimes(1);

        return done();
      });

    jest.runOnlyPendingTimers();
  });
});
