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
import { TextEncoder } from 'util';
import {
  measureGuestToken,
  guestAuthenticationMessage,
} from './guestTokenDiagnostics';

beforeAll(() => {
  Object.assign(global, { TextEncoder });
});

test.each([
  [20, true],
  [21, false],
  [22, false],
  [null, false],
  [0, false],
  [-1, false],
])('header budget %s: exceeded=%s', (budget, exceeded) => {
  expect(measureGuestToken('é'.repeat(3), 'X-Custom-É', budget)).toEqual({
    tokenBytes: 6,
    headerBytes: 21,
    headerBudgetBytes: budget && budget > 0 ? budget : null,
    headerBudgetExceeded: exceeded,
  });
});

test('default header accounting and safe metadata only', () => {
  const size = measureGuestToken('secret-token', undefined, 1);
  expect(size.headerBytes).toBe(28);
  expect(JSON.stringify(size)).not.toContain('secret-token');
  expect(guestAuthenticationMessage(size)).toContain('may exceed');
});

test('no size evidence uses generic authentication message', () => {
  expect(guestAuthenticationMessage()).not.toContain('may exceed');
  expect(guestAuthenticationMessage(measureGuestToken('t'))).not.toContain(
    'may exceed',
  );
});

test.each([
  ['16384', null],
  ['invalid', null],
  [true, null],
  [false, null],
  [[], null],
  [{}, null],
  [20.5, null],
  [NaN, null],
  [Infinity, null],
  [-Infinity, null],
  [2 ** 53, null],
  [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  [16384.0, 16384],
])('normalizes configured budget %p to %p', (configured, expected) => {
  const size = measureGuestToken('t', undefined, configured);
  expect(size.headerBudgetBytes).toBe(expected);
  expect(size.headerBudgetExceeded).toBe(false);
});

test.each([undefined, 400, 431, 494])(
  'uses header-size evidence for status %p',
  status => {
    expect(
      guestAuthenticationMessage(measureGuestToken('t', undefined, 1), {
        status,
      }),
    ).toContain('may exceed');
    expect(
      guestAuthenticationMessage(measureGuestToken('t', undefined, 100), {
        status,
      }),
    ).not.toContain('may exceed');
  },
);

test.each([401, 403, 413, 500])('keeps status %p generic', status => {
  expect(
    guestAuthenticationMessage(measureGuestToken('t', undefined, 1), {
      status,
    }),
  ).not.toContain('may exceed');
});
