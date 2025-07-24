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

import { NumberFormatter, createMemoryFormatter } from '@superset-ui/core';

test('creates an instance of MemoryFormatter', () => {
  const formatter = createMemoryFormatter();
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('formats bytes in human readable format with default options', () => {
  const formatter = createMemoryFormatter();
  expect(formatter(0)).toBe('0B');
  expect(formatter(50)).toBe('50B');
  expect(formatter(555)).toBe('555B');
  expect(formatter(1000)).toBe('1kB');
  expect(formatter(1111)).toBe('1.11kB');
  expect(formatter(1024)).toBe('1.02kB');
  expect(formatter(1337)).toBe('1.34kB');
  expect(formatter(1999)).toBe('2kB');
  expect(formatter(10 * 1000)).toBe('10kB');
  expect(formatter(100 * 1000)).toBe('100kB');
  expect(formatter(Math.pow(1000, 2))).toBe('1MB');
  expect(formatter(Math.pow(1000, 3))).toBe('1GB');
  expect(formatter(Math.pow(1000, 4))).toBe('1TB');
  expect(formatter(Math.pow(1000, 5))).toBe('1PB');
  expect(formatter(Math.pow(1000, 6))).toBe('1EB');
  expect(formatter(Math.pow(1000, 7))).toBe('1ZB');
  expect(formatter(Math.pow(1000, 8))).toBe('1YB');
  expect(formatter(Math.pow(1000, 9))).toBe('1RB');
  expect(formatter(Math.pow(1000, 10))).toBe('1QB');
  expect(formatter(Math.pow(1000, 11))).toBe('1000QB');
  expect(formatter(Math.pow(1000, 12))).toBe('1000000QB');
});

test('formats negative bytes in human readable format with default options', () => {
  const formatter = createMemoryFormatter();
  expect(formatter(-50)).toBe('-50B');
});

test('formats float bytes in human readable format with default options', () => {
  const formatter = createMemoryFormatter();
  expect(formatter(10.666)).toBe('10.67B');
  expect(formatter(1200.666)).toBe('1.2kB');
});

test('formats bytes in human readable format with additional binary option', () => {
  const formatter = createMemoryFormatter({ binary: true });
  expect(formatter(0)).toBe('0B');
  expect(formatter(50)).toBe('50B');
  expect(formatter(555)).toBe('555B');
  expect(formatter(1000)).toBe('1000B');
  expect(formatter(1111)).toBe('1.08KiB');
  expect(formatter(1024)).toBe('1KiB');
  expect(formatter(1337)).toBe('1.31KiB');
  expect(formatter(2047)).toBe('2KiB');
  expect(formatter(10 * 1024)).toBe('10KiB');
  expect(formatter(100 * 1024)).toBe('100KiB');
  expect(formatter(Math.pow(1024, 2))).toBe('1MiB');
  expect(formatter(Math.pow(1024, 3))).toBe('1GiB');
  expect(formatter(Math.pow(1024, 4))).toBe('1TiB');
  expect(formatter(Math.pow(1024, 5))).toBe('1PiB');
  expect(formatter(Math.pow(1024, 6))).toBe('1EiB');
  expect(formatter(Math.pow(1024, 7))).toBe('1ZiB');
  expect(formatter(Math.pow(1024, 8))).toBe('1YiB');
  expect(formatter(Math.pow(1024, 9))).toBe('1024YiB');
  expect(formatter(Math.pow(1024, 10))).toBe('1048576YiB');
});

test('formats bytes in human readable format with additional transfer option', () => {
  const formatter = createMemoryFormatter({ transfer: true });
  expect(formatter(0)).toBe('0B/s');
  expect(formatter(50)).toBe('50B/s');
  expect(formatter(555)).toBe('555B/s');
  expect(formatter(1000)).toBe('1kB/s');
  expect(formatter(1111)).toBe('1.11kB/s');
  expect(formatter(1024)).toBe('1.02kB/s');
  expect(formatter(1337)).toBe('1.34kB/s');
  expect(formatter(1999)).toBe('2kB/s');
  expect(formatter(10 * 1000)).toBe('10kB/s');
  expect(formatter(100 * 1000)).toBe('100kB/s');
  expect(formatter(Math.pow(1000, 2))).toBe('1MB/s');
  expect(formatter(Math.pow(1000, 3))).toBe('1GB/s');
  expect(formatter(Math.pow(1000, 4))).toBe('1TB/s');
  expect(formatter(Math.pow(1000, 5))).toBe('1PB/s');
  expect(formatter(Math.pow(1000, 6))).toBe('1EB/s');
  expect(formatter(Math.pow(1000, 7))).toBe('1ZB/s');
  expect(formatter(Math.pow(1000, 8))).toBe('1YB/s');
  expect(formatter(Math.pow(1000, 9))).toBe('1RB/s');
  expect(formatter(Math.pow(1000, 10))).toBe('1QB/s');
  expect(formatter(Math.pow(1000, 11))).toBe('1000QB/s');
  expect(formatter(Math.pow(1000, 12))).toBe('1000000QB/s');
});

test('formats bytes in human readable format with additional binary AND transfer option', () => {
  const formatter = createMemoryFormatter({ binary: true, transfer: true });
  expect(formatter(0)).toBe('0B/s');
  expect(formatter(50)).toBe('50B/s');
  expect(formatter(555)).toBe('555B/s');
  expect(formatter(1000)).toBe('1000B/s');
  expect(formatter(1111)).toBe('1.08KiB/s');
  expect(formatter(1024)).toBe('1KiB/s');
  expect(formatter(1337)).toBe('1.31KiB/s');
  expect(formatter(2047)).toBe('2KiB/s');
  expect(formatter(10 * 1024)).toBe('10KiB/s');
  expect(formatter(100 * 1024)).toBe('100KiB/s');
  expect(formatter(Math.pow(1024, 2))).toBe('1MiB/s');
  expect(formatter(Math.pow(1024, 3))).toBe('1GiB/s');
  expect(formatter(Math.pow(1024, 4))).toBe('1TiB/s');
  expect(formatter(Math.pow(1024, 5))).toBe('1PiB/s');
  expect(formatter(Math.pow(1024, 6))).toBe('1EiB/s');
  expect(formatter(Math.pow(1024, 7))).toBe('1ZiB/s');
  expect(formatter(Math.pow(1024, 8))).toBe('1YiB/s');
  expect(formatter(Math.pow(1024, 9))).toBe('1024YiB/s');
  expect(formatter(Math.pow(1024, 10))).toBe('1048576YiB/s');
});

test('formats bytes in human readable format with additional decimals option', () => {
  const formatter0decimals = createMemoryFormatter({ decimals: 0 });
  expect(formatter0decimals(0)).toBe('0B');
  expect(formatter0decimals(1111)).toBe('1kB');

  const formatter3decimals = createMemoryFormatter({ decimals: 3 });
  expect(formatter3decimals(0)).toBe('0B');
  expect(formatter3decimals(1111)).toBe('1.111kB');
});
