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
  calendarDaysUntil,
  expiryLines,
  isExpiringSoon,
  jwtExpiresAt,
  replacedTokens,
} from './expiry';

const base64url = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const HEADER = base64url('{"alg":"HS256","typ":"JWT"}');
// A token whose payload is this JSON text.
const tokenOf = (payload: string) =>
  `${HEADER}.${base64url(payload)}.c2lnbmF0dXJl`;
const tokenExpiring = (at: string) =>
  tokenOf(JSON.stringify({ sub: 'svc', exp: Date.parse(at) / 1000 }));

const MASK = 'XXXXXXXXXX';
const STORED = JSON.stringify({ connect_args: { jwt: MASK, password: MASK } });
const PATHS = ['$.connect_args.jwt', '$.connect_args.password'];
const withJwt = (jwt: unknown) =>
  JSON.stringify({ connect_args: { jwt, password: MASK } });
const LABELS = { '$.connect_args.jwt': 'JWT Token' };
const EXPIRED_STORED = {
  '$.connect_args.jwt': {
    expires_at: '2026-11-03T12:00:00+00:00',
    expired: true,
  },
};

// Noon UTC is 07:00 on Nov 5 under the jest timezone, America/New_York.
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-05T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

test('a token expiring later the same calendar day is 0 days away and expiring soon', () => {
  expect(calendarDaysUntil('2026-11-05T22:50:00Z')).toBe(0);
  expect(isExpiringSoon('2026-11-05T22:50:00Z')).toBe(true);
});

test('a token 7 calendar days away is expiring soon', () => {
  expect(calendarDaysUntil('2026-11-12T12:00:00Z')).toBe(7);
  expect(isExpiringSoon('2026-11-12T12:00:00Z')).toBe(true);
});

test('a token 8 calendar days away is not expiring soon, even under 8 days of hours', () => {
  // Nov 13 at 00:30 in New York, 7 days and 17.5 hours ahead.
  expect(calendarDaysUntil('2026-11-13T05:30:00Z')).toBe(8);
  expect(isExpiringSoon('2026-11-13T05:30:00Z')).toBe(false);
});

test('a token from a past calendar day counts as expiring soon', () => {
  // The server decides whether it has expired; the browser clock already passed it.
  expect(calendarDaysUntil('2026-11-03T12:00:00Z')).toBe(-2);
  expect(isExpiringSoon('2026-11-03T12:00:00Z')).toBe(true);
});

test('an invalid date counts no days and is not expiring soon', () => {
  expect(calendarDaysUntil('not a date')).toBeNaN();
  expect(isExpiringSoon('not a date')).toBe(false);
});

test('jwtExpiresAt reads the exp claim of a JWT, ignoring surrounding whitespace', () => {
  expect(jwtExpiresAt(tokenExpiring('2027-02-22T12:00:00Z'))).toBe(
    '2027-02-22T12:00:00.000Z',
  );
  expect(jwtExpiresAt(`  ${tokenExpiring('2027-02-22T12:00:00Z')}\n`)).toBe(
    '2027-02-22T12:00:00.000Z',
  );
});

test('jwtExpiresAt reads nothing from a value without a usable exp', () => {
  [
    'not a token',
    'a.b',
    `.${base64url('{"exp":1}')}.sig`,
    `${HEADER}.${base64url('{"exp":1}')}.sig!`,
    `${base64url('[1]')}.${base64url('{"exp":1}')}.sig`,
    tokenOf('{"sub":"svc"}'),
    tokenOf('{"exp":true}'),
    tokenOf('{"exp":"1893456000"}'),
    tokenOf('{"exp":-1}'),
    tokenOf('{"exp":253402300800}'),
    tokenOf('[1893456000]'),
    tokenOf('not json'),
  ].forEach(value => expect(jwtExpiresAt(value)).toBeUndefined());
});

test('replacedTokens lists nothing while every stored value is still masked', () => {
  expect(replacedTokens(STORED, STORED, PATHS)).toEqual({});
  // Reformatted, with other keys edited.
  expect(
    replacedTokens(
      STORED,
      JSON.stringify(
        { connect_args: { password: MASK, jwt: MASK }, other: 1 },
        null,
        2,
      ),
      PATHS,
    ),
  ).toEqual({});
});

test('replacedTokens gives the expiry of a new JWT, and null for a new value without one', () => {
  expect(
    replacedTokens(
      STORED,
      withJwt(tokenExpiring('2027-02-22T12:00:00Z')),
      PATHS,
    ),
  ).toEqual({ '$.connect_args.jwt': '2027-02-22T12:00:00.000Z' });
  expect(replacedTokens(STORED, withJwt('plain secret'), PATHS)).toEqual({
    '$.connect_args.jwt': null,
  });
  expect(replacedTokens(STORED, withJwt({ nested: 1 }), PATHS)).toEqual({
    '$.connect_args.jwt': null,
  });
  expect(
    replacedTokens(STORED, JSON.stringify({ connect_args: {} }), PATHS),
  ).toEqual({ '$.connect_args.jwt': null, '$.connect_args.password': null });
});

test('replacedTokens reads nothing from invalid JSON or without the stored JSON', () => {
  expect(
    replacedTokens(STORED, '{"connect_args": {"jwt": "eyJ', PATHS),
  ).toBeUndefined();
  expect(
    replacedTokens(
      undefined,
      withJwt(tokenExpiring('2027-02-22T12:00:00Z')),
      PATHS,
    ),
  ).toEqual({});
});

test('a replaced token that expires after the warning window is confirmed, not warned about', () => {
  expect(
    expiryLines(LABELS, EXPIRED_STORED, {
      '$.connect_args.jwt': '2027-02-22T12:00:00.000Z',
    }),
  ).toEqual([
    expect.objectContaining({
      path: '$.connect_args.jwt',
      text: 'The new JWT Token expires on Feb 22, 2027. Click Finish to save it.',
      severity: 'success',
      replaced: true,
    }),
  ]);
});

test('a replaced token that already expired or expires soon is warned about as the new one', () => {
  const [expired] = expiryLines(LABELS, EXPIRED_STORED, {
    '$.connect_args.jwt': '2026-11-04T12:00:00.000Z',
  });
  expect(expired).toEqual(
    expect.objectContaining({
      text: 'The new, unsaved JWT Token expired on Nov 4, 2026.',
      severity: 'error',
      expired: true,
      replaced: true,
    }),
  );
  const [expiring] = expiryLines(LABELS, EXPIRED_STORED, {
    '$.connect_args.jwt': '2026-11-08T12:00:00.000Z',
  });
  expect(expiring).toEqual(
    expect.objectContaining({
      text: 'The new, unsaved JWT Token expires in 3 days (Nov 8, 2026).',
      severity: 'warning',
      expired: false,
      replaced: true,
    }),
  );
  const [today] = expiryLines(LABELS, EXPIRED_STORED, {
    '$.connect_args.jwt': '2026-11-05T22:50:00.000Z',
  });
  expect(today.text).toBe(
    'The new, unsaved JWT Token expires today at 5:50 PM.',
  );
});

test('a replaced value without a readable expiry drops the stale line and claims nothing', () => {
  expect(
    expiryLines(LABELS, EXPIRED_STORED, { '$.connect_args.jwt': null }),
  ).toEqual([]);
});

test('stored lines keep their severity and are not marked replaced', () => {
  expect(expiryLines(LABELS, EXPIRED_STORED)).toEqual([
    expect.objectContaining({
      text: 'The stored JWT Token expired on Nov 3, 2026.',
      severity: 'error',
      replaced: false,
    }),
  ]);
});

test('a replaced token is told apart by its path when its label is shared', () => {
  const lines = expiryLines(
    {
      '$.auth_params.token': 'JWT Token',
      '$.connect_args.jwt': 'JWT Token',
    },
    {
      ...EXPIRED_STORED,
      '$.auth_params.token': {
        expires_at: '2026-11-03T12:00:00+00:00',
        expired: true,
      },
    },
    { '$.connect_args.jwt': '2027-02-22T12:00:00.000Z' },
  );
  expect(lines.map(({ text }) => text)).toEqual([
    'The stored JWT Token (auth_params.token) expired on Nov 3, 2026.',
    'The new JWT Token (connect_args.jwt) expires on Feb 22, 2027. Click Finish to save it.',
  ]);
});
