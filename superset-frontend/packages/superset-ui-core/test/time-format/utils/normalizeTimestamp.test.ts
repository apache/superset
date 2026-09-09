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

import normalizeTimestamp from '../../../src/time-format/utils/normalizeTimestamp';

test('normalizeTimestamp should normalize typical timestamps', () => {
  expect(normalizeTimestamp('2023-03-11 08:26:52.695 UTC')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11 08:26:52.695 Europe/Helsinki')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11T08:26:52.695 UTC')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11T08:26:52.695')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11 08:26:52')).toEqual(
    '2023-03-11T08:26:52Z',
  );
});

test('normalizeTimestamp should return unmatched timestamps as-is', () => {
  expect(normalizeTimestamp('abcd')).toEqual('abcd');
  expect(normalizeTimestamp('03/11/2023')).toEqual('03/11/2023');
});

test('normalizeTimestamp should not rewrite timestamps with an explicit UTC offset', () => {
  expect(normalizeTimestamp('2026-01-15T12:30:00+03:30')).toEqual(
    '2026-01-15T12:30:00+03:30',
  );
  expect(normalizeTimestamp('2026-01-15T12:30:00Z')).toEqual(
    '2026-01-15T12:30:00Z',
  );
  expect(normalizeTimestamp('2026-01-15T12:30:00-05:00')).toEqual(
    '2026-01-15T12:30:00-05:00',
  );
  expect(normalizeTimestamp('2026-01-15 12:30:00+0330')).toEqual(
    '2026-01-15 12:30:00+0330',
  );
});

test('normalizeTimestamp preserves fractional seconds on offset-carrying values', () => {
  // DateTime64(3) arrives with milliseconds: the offset-aware passthrough
  // must keep them verbatim, not truncate to whole seconds.
  expect(normalizeTimestamp('2026-01-15T12:30:00.123000+03:30')).toEqual(
    '2026-01-15T12:30:00.123000+03:30',
  );
  expect(normalizeTimestamp('2026-01-15T12:30:00.123+03:30')).toEqual(
    '2026-01-15T12:30:00.123+03:30',
  );
});

test('a DST fall-back pair keeps distinct instants distinct', () => {
  // 2026-11-01 is the US DST fall-back: identical wall times with -04:00
  // (still EDT) and -05:00 (after the switch) are one hour apart. The old
  // normalizer collapsed both to the same epoch by rewriting the offset
  // to Z; the passthrough must keep them distinguishable.
  const edt = '2026-11-01T01:30:00-04:00';
  const est = '2026-11-01T01:30:00-05:00';
  expect(normalizeTimestamp(edt)).toEqual(edt);
  expect(normalizeTimestamp(est)).toEqual(est);
  expect(new Date(normalizeTimestamp(edt)).getTime()).toBe(
    new Date('2026-11-01T05:30:00Z').getTime(),
  );
  expect(new Date(normalizeTimestamp(est)).getTime()).toBe(
    new Date('2026-11-01T06:30:00Z').getTime(),
  );
  expect(new Date(normalizeTimestamp(edt)).getTime()).not.toBe(
    new Date(normalizeTimestamp(est)).getTime(),
  );
});
