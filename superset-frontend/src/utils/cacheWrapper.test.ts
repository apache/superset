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
import { cacheWrapper } from 'src/utils/cacheWrapper';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('cacheWrapper', () => {
  test('retries a key after its cached promise rejects', async () => {
    const request = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');
    const cache = new Map<string, Promise<string>>();
    const cachedRequest = cacheWrapper(request, cache);

    await expect(cachedRequest('resource')).rejects.toThrow('transient');
    await expect(cachedRequest('resource')).resolves.toBe('recovered');
    expect(request).toHaveBeenCalledTimes(2);
  });

  test('shares an in-flight promise and retains its fulfilled result', async () => {
    let resolveRequest: (value: string) => void = () => {};
    const request = jest.fn<Promise<string>, [string]>().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve;
        }),
    );
    const cachedRequest = cacheWrapper(
      request,
      new Map<string, Promise<string>>(),
    );

    const first = cachedRequest('resource');
    expect(cachedRequest('resource')).toBe(first);
    resolveRequest('fulfilled');
    await expect(first).resolves.toBe('fulfilled');
    expect(cachedRequest('resource')).toBe(first);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('does not evict a replacement after an older promise rejects', async () => {
    let rejectRequest: (reason: Error) => void = () => {};
    const request = jest.fn<Promise<string>, [string]>().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const cache = new Map<string, Promise<string>>();
    const cachedRequest = cacheWrapper(request, cache);
    const first = cachedRequest('resource');
    const replacement = Promise.resolve('newer');
    cache.set(JSON.stringify(['resource']), replacement);

    rejectRequest(new Error('older request failed'));
    await expect(first).rejects.toThrow('older request failed');
    expect(cache.get(JSON.stringify(['resource']))).toBe(replacement);
    expect(cachedRequest('resource')).toBe(replacement);
  });

  const fnResult = 'fnResult';
  const fn = jest.fn<string, [number, number]>().mockReturnValue(fnResult);

  let wrappedFn: (a: number, b: number) => string;

  beforeEach(() => {
    const cache = new Map<string, any>();
    wrappedFn = cacheWrapper(fn, cache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('calls fn with its arguments once when the key is not found', () => {
    const returnedValue = wrappedFn(1, 2);

    expect(returnedValue).toEqual(fnResult);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('subsequent calls', () => {
    test('returns the correct value without fn being called multiple times', () => {
      const returnedValue1 = wrappedFn(1, 2);
      const returnedValue2 = wrappedFn(1, 2);

      expect(returnedValue1).toEqual(fnResult);
      expect(returnedValue2).toEqual(fnResult);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('fn is called multiple times for different arguments', () => {
      wrappedFn(1, 2);
      wrappedFn(1, 3);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('with custom keyFn', () => {
    let cache: Map<string, any>;

    beforeEach(() => {
      cache = new Map<string, any>();
      wrappedFn = cacheWrapper(fn, cache, (...args) => `key-${args[0]}`);
    });

    test('saves fn result in cache under generated key', () => {
      wrappedFn(1, 2);
      expect(cache.get('key-1')).toEqual(fnResult);
    });

    test('subsequent calls with same generated key calls fn once, even if other arguments have changed', () => {
      wrappedFn(1, 1);
      wrappedFn(1, 2);
      wrappedFn(1, 3);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
