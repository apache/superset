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

import { getFormattedUTCTime } from '../src/utils';

describe('getFormattedUTCTime', () => {
  it('formatted date string should equal to UTC date', () => {
    const ts = 1420070400000; // 2015.01.01 00:00:00 UTC
    const formattedTime = getFormattedUTCTime(ts, '%Y-%m-%d %H:%M:%S');
    expect(formattedTime).toEqual('2015-01-01 00:00:00');
  });

  it('should not have day offset for dates near midnight', () => {
    // Test case from issue #28931 - 2024-05-31 should remain 2024-05-31
    const ts = new Date('2024-05-31T00:00:00Z').getTime();
    const formattedTime = getFormattedUTCTime(ts, '%Y-%m-%d');
    expect(formattedTime).toEqual('2024-05-31');
  });

  it('should handle different timezones without offset', () => {
    // Test various timestamps to ensure no day shifting occurs
    const testCases = [
      {
        ts: new Date('2024-05-31T23:59:59Z').getTime(),
        expected: '2024-05-31',
      },
      {
        ts: new Date('2024-06-01T00:00:00Z').getTime(),
        expected: '2024-06-01',
      },
      {
        ts: new Date('2024-01-01T12:00:00Z').getTime(),
        expected: '2024-01-01',
      },
    ];

    testCases.forEach(({ ts, expected }) => {
      const formattedTime = getFormattedUTCTime(ts, '%Y-%m-%d');
      expect(formattedTime).toEqual(expected);
    });
  });
});
