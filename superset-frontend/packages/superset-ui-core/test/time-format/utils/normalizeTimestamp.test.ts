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
