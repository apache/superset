/*
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

import { lruCache } from '@superset-ui/core';

test('initial LRU', () => {
  expect(lruCache().capacity).toBe(100);
  expect(lruCache(10).capacity).toBe(10);
  expect(lruCache(10).size).toBe(0);
  expect(() => lruCache(0)).toThrow(Error);
});

test('LRU operations', () => {
  const cache = lruCache<string>(3);
  cache.set('1', 'a');
  cache.set('2', 'b');
  cache.set('3', 'c');
  cache.set('4', 'd');
  expect(cache.size).toBe(3);
  expect(cache.has('1')).toBeFalsy();
  expect(cache.get('1')).toBeUndefined();
  cache.get('2');
  cache.set('5', 'e');
  expect(cache.has('2')).toBeTruthy();
  expect(cache.has('3')).toBeFalsy();
  // @ts-expect-error
  expect(() => cache.set(0)).toThrow(TypeError);
  // @ts-expect-error
  expect(() => cache.get(0)).toThrow(TypeError);
  expect(cache.size).toBe(3);
  cache.clear();
  expect(cache.size).toBe(0);
  expect(cache.capacity).toBe(3);
});

test('LRU handle null and undefined', () => {
  const cache = lruCache();
  cache.set('a', null);
  cache.set('b', undefined);
  expect(cache.has('a')).toBeTruthy();
  expect(cache.has('b')).toBeTruthy();
  expect(cache.get('a')).toBeNull();
  expect(cache.get('b')).toBeUndefined();
});
