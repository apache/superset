/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { logging } from '@apache-superset/core/utils';
import {
  loadSharedFilterState,
  SHARED_STATE_ATTEMPT_TIMEOUT_MS,
  SHARED_STATE_MAX_ATTEMPTS,
  SHARED_STATE_RETRY_DELAY_MS,
} from './loadSharedFilterState';

jest.mock('@apache-superset/core/utils', () => ({
  logging: { warn: jest.fn(), error: jest.fn() },
}));

const warn = logging.warn as jest.Mock;
const ALL_ATTEMPTS_MS =
  SHARED_STATE_MAX_ATTEMPTS * SHARED_STATE_ATTEMPT_TIMEOUT_MS +
  (SHARED_STATE_MAX_ATTEMPTS - 1) * SHARED_STATE_RETRY_DELAY_MS;

beforeEach(() => {
  jest.useFakeTimers();
  warn.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

test('returns the value without warning when the first attempt succeeds', async () => {
  const fetcher = jest.fn().mockResolvedValue({ a: 1 });

  const result = await loadSharedFilterState(
    fetcher,
    new AbortController().signal,
  );

  expect(result).toEqual({ status: 'ok', value: { a: 1 } });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

test('retries after an error and succeeds without warning', async () => {
  const fetcher = jest
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce('ok');

  const promise = loadSharedFilterState(fetcher, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(SHARED_STATE_RETRY_DELAY_MS);

  expect(await promise).toEqual({ status: 'ok', value: 'ok' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(warn).not.toHaveBeenCalled();
});

test('does not retry a 404 and reports the key as expired', async () => {
  const fetcher = jest.fn().mockRejectedValue({ status: 404 });

  const result = await loadSharedFilterState(
    fetcher,
    new AbortController().signal,
  );

  expect(result).toEqual({ status: 'expired' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

test('does not retry an unreadable stored value and reports it as expired', async () => {
  const fetcher = jest
    .fn()
    .mockRejectedValue(new SyntaxError('Unexpected token'));

  const result = await loadSharedFilterState(
    fetcher,
    new AbortController().signal,
  );

  expect(result).toEqual({ status: 'expired' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

test('fails and warns once after every attempt times out', async () => {
  const fetcher = jest.fn().mockReturnValue(new Promise(() => {}));

  const promise = loadSharedFilterState(fetcher, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(ALL_ATTEMPTS_MS);

  expect(await promise).toEqual({ status: 'failed' });
  expect(fetcher).toHaveBeenCalledTimes(SHARED_STATE_MAX_ATTEMPTS);
  expect(warn).toHaveBeenCalledTimes(1);
  const signals = fetcher.mock.calls.map(([signal]) => signal);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

test('fails without a timeout warning when attempts error quickly', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('boom'));

  const promise = loadSharedFilterState(fetcher, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(SHARED_STATE_RETRY_DELAY_MS);

  expect(await promise).toEqual({ status: 'failed' });
  expect(warn).not.toHaveBeenCalled();
});

test('cancelling mid-attempt neither retries nor warns', async () => {
  const controller = new AbortController();
  const fetcher = jest.fn().mockReturnValue(new Promise(() => {}));

  const promise = loadSharedFilterState(fetcher, controller.signal);
  await jest.advanceTimersByTimeAsync(100);
  controller.abort();
  await jest.advanceTimersByTimeAsync(ALL_ATTEMPTS_MS);

  expect(await promise).toEqual({ status: 'cancelled' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

test('cancelling during the retry delay stops further attempts', async () => {
  const controller = new AbortController();
  const fetcher = jest.fn().mockRejectedValue(new Error('network'));

  const promise = loadSharedFilterState(fetcher, controller.signal);
  await jest.advanceTimersByTimeAsync(100);
  controller.abort();
  await jest.advanceTimersByTimeAsync(ALL_ATTEMPTS_MS);

  expect(await promise).toEqual({ status: 'cancelled' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
