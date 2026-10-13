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
import { Suspense } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { lazyWithRetry, retryImport } from './lazyWithRetry';

const chunkLoadError = () => {
  const error = new Error('Loading chunk 4169 failed.');
  error.name = 'ChunkLoadError';
  return error;
};

const Page = () => <div>Lazy page</div>;

test('lazyWithRetry recovers from a transient ChunkLoadError (#41266)', async () => {
  const factory = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError())
    .mockResolvedValue({ default: Page });

  const LazyPage = lazyWithRetry(factory, { retryDelayMs: 0 });

  render(
    <Suspense fallback={<div>Loading</div>}>
      <LazyPage />
    </Suspense>,
  );

  expect(await screen.findByText('Lazy page')).toBeInTheDocument();
  expect(factory).toHaveBeenCalledTimes(2);
});

test('retryImport exhausts its attempts and rethrows the last error (#41266)', async () => {
  const factory = jest.fn().mockRejectedValue(chunkLoadError());

  await expect(
    retryImport(factory, { retries: 2, retryDelayMs: 0 }),
  ).rejects.toThrow('Loading chunk 4169 failed.');
  expect(factory).toHaveBeenCalledTimes(3);
});

test('retryImport does not retry a successful import (#41266)', async () => {
  const factory = jest.fn().mockResolvedValue({ default: Page });

  await expect(retryImport(factory, { retryDelayMs: 0 })).resolves.toEqual({
    default: Page,
  });
  expect(factory).toHaveBeenCalledTimes(1);
});

test('retryImport does not retry a deterministic, non-chunk error', async () => {
  const factory = jest
    .fn()
    .mockRejectedValue(new SyntaxError('Unexpected token'));

  await expect(
    retryImport(factory, { retries: 2, retryDelayMs: 0 }),
  ).rejects.toThrow('Unexpected token');
  expect(factory).toHaveBeenCalledTimes(1);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('retryImport doubles the jitter bound on each subsequent attempt (#41266)', async () => {
  jest.useFakeTimers();
  const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  jest.spyOn(Math, 'random').mockReturnValue(1);

  const factory = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError())
    .mockRejectedValueOnce(chunkLoadError())
    .mockResolvedValue({ default: Page });

  const result = retryImport(factory, { retryDelayMs: 1000 });
  await jest.runAllTimersAsync();

  await expect(result).resolves.toEqual({ default: Page });
  // Math.random pinned to its max (1): each delay is the full bound, so the
  // bound itself (retryDelayMs * 2 ** attempt) is what's under test here.
  const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
  expect(delays).toEqual([1000, 2000]);
});

test('retryImport spreads concurrent retries instead of synchronizing them (#41266)', async () => {
  jest.useFakeTimers();
  const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  // Two "clients" hit the same failing chunk at the same moment. Full
  // jitter should keep their retry delays from lining up even though both
  // see the exact same kind of failure on the exact same attempt.
  jest.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.7);

  const clientA = retryImport(
    jest
      .fn()
      .mockRejectedValueOnce(chunkLoadError())
      .mockResolvedValue({ default: Page }),
    { retryDelayMs: 1000 },
  );
  const clientB = retryImport(
    jest
      .fn()
      .mockRejectedValueOnce(chunkLoadError())
      .mockResolvedValue({ default: Page }),
    { retryDelayMs: 1000 },
  );

  await jest.runAllTimersAsync();
  await expect(Promise.all([clientA, clientB])).resolves.toEqual([
    { default: Page },
    { default: Page },
  ]);

  // If the jitter were ever dropped (going back to a fixed backoff), both
  // clients would retry at the same delay - this fails the moment that
  // happens instead of silently passing like a retryDelayMs: 0 test would.
  const [delayA, delayB] = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
  expect(delayA).toBe(300);
  expect(delayB).toBe(700);
  expect(delayA).not.toBe(delayB);
});
