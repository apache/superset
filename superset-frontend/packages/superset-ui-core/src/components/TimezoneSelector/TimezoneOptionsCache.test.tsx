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

import { TimezoneOptionsCache } from './TimezoneOptionsCache';
import type { OffsetsToName, GetOffsetKeyFn } from './types';

const mockGetOffsetKey: GetOffsetKeyFn = (timezoneName: string) => {
  // Simplified mock for testing - returns different values for different zones
  if (timezoneName.includes('New_York')) return '-300-240';
  if (timezoneName.includes('Los_Angeles')) return '-480-420';
  if (timezoneName.includes('Chicago')) return '-360-300';
  if (timezoneName.includes('London')) return '060';
  return '00';
};

const mockOffsetsToName: OffsetsToName = {
  '-300-240': ['Eastern Standard Time', 'Eastern Daylight Time'],
  '-480-420': ['Pacific Standard Time', 'Pacific Daylight Time'],
  '-360-300': ['Central Standard Time', 'Central Daylight Time'],
  '060': ['GMT Standard Time - London', 'British Summer Time'],
  '00': ['GMT Standard Time', 'GMT Standard Time'],
};

// Mock Intl.supportedValuesOf to return a controlled set of timezones
const mockTimezones = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Africa/Abidjan',
];

beforeAll(() => {
  global.Intl.supportedValuesOf = jest.fn(() => mockTimezones);
});

afterAll(() => {
  jest.restoreAllMocks();
});

test('initializes with empty cache', () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  expect(cache.isCached()).toBe(false);
  expect(cache.getOptions()).toBeNull();
});

test('isCached returns true after options are computed', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  expect(cache.isCached()).toBe(false);

  await cache.getOptionsAsync();

  expect(cache.isCached()).toBe(true);
});

test('getOptions returns null before caching', () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  expect(cache.getOptions()).toBeNull();
});

test('getOptions returns cached options after computation', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  await cache.getOptionsAsync();
  const options = cache.getOptions();

  expect(options).not.toBeNull();
  expect(Array.isArray(options)).toBe(true);
  expect(options!.length).toBeGreaterThan(0);
});

test('getOptionsAsync computes and returns timezone options', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const options = await cache.getOptionsAsync();

  expect(Array.isArray(options)).toBe(true);
  expect(options.length).toBeGreaterThan(0);

  // Check that each option has the required structure
  options.forEach(option => {
    expect(option).toHaveProperty('label');
    expect(option).toHaveProperty('value');
    expect(option).toHaveProperty('offsets');
    expect(option).toHaveProperty('timezoneName');
    expect(typeof option.label).toBe('string');
    expect(typeof option.value).toBe('string');
    expect(typeof option.offsets).toBe('string');
    expect(typeof option.timezoneName).toBe('string');
  });
});

test('getOptionsAsync returns cached options on subsequent calls', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const firstCall = await cache.getOptionsAsync();
  const secondCall = await cache.getOptionsAsync();

  // Should return the exact same array reference (cached)
  expect(secondCall).toBe(firstCall);
});

test('getOptionsAsync deduplicates concurrent calls', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  // Make multiple concurrent calls
  const promise1 = cache.getOptionsAsync();
  const promise2 = cache.getOptionsAsync();
  const promise3 = cache.getOptionsAsync();

  // All promises should be the same instance
  expect(promise2).toBe(promise1);
  expect(promise3).toBe(promise1);

  const [result1, result2, result3] = await Promise.all([
    promise1,
    promise2,
    promise3,
  ]);

  // All results should be the same
  expect(result2).toBe(result1);
  expect(result3).toBe(result1);
});

test('options have correct label format', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const options = await cache.getOptionsAsync();

  // Check that labels follow the GMT format
  options.forEach(option => {
    expect(option.label).toMatch(/^GMT [+-]\d{2}:\d{2} \(.+\)$/);
  });
});

test('options include offset information', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const options = await cache.getOptionsAsync();

  // Verify that options have offset keys
  options.forEach(option => {
    expect(option.offsets).toBeTruthy();
    expect(option.offsets.length).toBeGreaterThan(0);
  });
});

test('options deduplicate by label', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const options = await cache.getOptionsAsync();
  const labels = options.map(opt => opt.label);
  const uniqueLabels = new Set(labels);

  // All labels should be unique
  expect(labels.length).toBe(uniqueLabels.size);
});

test('each option has timezone name matching its value', async () => {
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  const options = await cache.getOptionsAsync();

  options.forEach(option => {
    expect(option.timezoneName).toBe(option.value);
  });
});

test('handles errors during computation', async () => {
  const errorGetOffsetKey: GetOffsetKeyFn = () => {
    throw new Error('Test error');
  };

  const cache = new TimezoneOptionsCache(errorGetOffsetKey, mockOffsetsToName);

  await expect(cache.getOptionsAsync()).rejects.toThrow('Test error');

  // Cache should remain empty after error
  expect(cache.isCached()).toBe(false);
  expect(cache.getOptions()).toBeNull();
});

test('allows retry after failed computation', async () => {
  let shouldFail = true;
  const conditionalGetOffsetKey: GetOffsetKeyFn = (timezoneName: string) => {
    if (shouldFail) {
      throw new Error('Temporary error');
    }
    return mockGetOffsetKey(timezoneName);
  };

  const cache = new TimezoneOptionsCache(
    conditionalGetOffsetKey,
    mockOffsetsToName,
  );

  // First call should fail
  await expect(cache.getOptionsAsync()).rejects.toThrow('Temporary error');
  expect(cache.isCached()).toBe(false);

  // Allow success on retry
  shouldFail = false;

  // Second call should succeed
  const options = await cache.getOptionsAsync();
  expect(Array.isArray(options)).toBe(true);
  expect(options.length).toBeGreaterThan(0);
  expect(cache.isCached()).toBe(true);
});

test('uses queueMicrotask when available', async () => {
  const queueMicrotaskSpy = jest.spyOn(global, 'queueMicrotask');
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  await cache.getOptionsAsync();

  expect(queueMicrotaskSpy).toHaveBeenCalled();

  queueMicrotaskSpy.mockRestore();
});

test('falls back to setTimeout when queueMicrotask is not available', async () => {
  const originalQueueMicrotask = global.queueMicrotask;
  // @ts-ignore - temporarily remove queueMicrotask for testing
  delete global.queueMicrotask;

  const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  const cache = new TimezoneOptionsCache(mockGetOffsetKey, mockOffsetsToName);

  await cache.getOptionsAsync();

  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);

  setTimeoutSpy.mockRestore();
  global.queueMicrotask = originalQueueMicrotask;
});
