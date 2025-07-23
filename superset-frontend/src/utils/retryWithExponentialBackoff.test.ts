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

import {
  retryWithExponentialBackoff,
  retryWithStaggeredDelay,
} from './retryWithExponentialBackoff';

describe('retryWithExponentialBackoff', () => {
  it('should return successful result without retry', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    const result = await retryWithExponentialBackoff(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure with exponential backoff', async () => {
    jest.useFakeTimers();

    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const onRetry = jest.fn();

    const promise = retryWithExponentialBackoff(mockFn, {
      maxRetries: 3,
      initialDelay: 1000,
      onRetry,
    });

    // First attempt fails immediately
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Advance time and flush promises for first retry
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 1000, new Error('fail 1'));

    // Advance time and flush promises for second retry
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledWith(2, 2000, new Error('fail 2'));

    const result = await promise;
    expect(result).toBe('success');

    jest.useRealTimers();
  });

  it('should respect maxRetries limit', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('always fails'));

    const promise = retryWithExponentialBackoff(mockFn, {
      maxRetries: 2,
      initialDelay: 100,
    });

    await expect(promise).rejects.toThrow('always fails');
    expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should respect shouldRetry condition', async () => {
    const error = new Error('do not retry');
    const mockFn = jest.fn().mockRejectedValue(error);

    const promise = retryWithExponentialBackoff(mockFn, {
      maxRetries: 3,
      shouldRetry: err => err.message !== 'do not retry',
    });

    await expect(promise).rejects.toThrow('do not retry');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should respect maxDelay limit', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('fail'));
    const onRetry = jest.fn();

    await expect(
      retryWithExponentialBackoff(mockFn, {
        maxRetries: 4,
        initialDelay: 1000,
        maxDelay: 3000,
        backoffMultiplier: 2,
        onRetry,
      }),
    ).rejects.toThrow('fail');

    // Check that delays are capped at maxDelay
    expect(onRetry).toHaveBeenCalledTimes(4);
    expect(onRetry).toHaveBeenCalledWith(1, 1000, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, 2000, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(3, 3000, expect.any(Error)); // capped
    expect(onRetry).toHaveBeenCalledWith(4, 3000, expect.any(Error)); // capped at maxDelay
  });
});

describe('retryWithStaggeredDelay', () => {
  it('should add stagger delay on first attempt', async () => {
    jest.useFakeTimers();

    const mockFn = jest.fn().mockResolvedValue('success');

    const promise = retryWithStaggeredDelay(mockFn, {
      staggerOffset: 500,
    });

    expect(mockFn).not.toHaveBeenCalled();

    // Advance past stagger delay
    await jest.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should apply random stagger when not specified', async () => {
    jest.useFakeTimers();

    const mockFn = jest.fn().mockResolvedValue('success');

    // Mock Math.random to return a predictable value
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.5);

    const promise = retryWithStaggeredDelay(mockFn);

    // Should wait for ~250ms (0.5 * 500)
    await jest.advanceTimersByTimeAsync(250);

    const result = await promise;
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);

    Math.random = originalRandom;
    jest.useRealTimers();
  });
});
