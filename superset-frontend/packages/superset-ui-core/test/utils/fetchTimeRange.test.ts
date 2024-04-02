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
  formatTimeRange,
  buildTimeRangeString,
} from '../../src/utils/fetchTimeRange';

describe('buildTimeRangeString', () => {
  it('generates proper time range string', () => {
    expect(
      buildTimeRangeString('2010-07-30T00:00:00', '2020-07-30T00:00:00'),
    ).toBe('2010-07-30T00:00:00 : 2020-07-30T00:00:00');
    expect(buildTimeRangeString('', '2020-07-30T00:00:00')).toBe(
      ' : 2020-07-30T00:00:00',
    );
    expect(buildTimeRangeString('', '')).toBe(' : ');
  });
});

describe('formatTimeRange', () => {
  it('generates a readable time range', () => {
    expect(formatTimeRange('Last 7 days')).toBe('Last 7 days');
    expect(formatTimeRange('No filter')).toBe('No filter');
    expect(formatTimeRange('Yesterday : Tomorrow')).toBe(
      'Yesterday ≤ col < Tomorrow',
    );
    expect(formatTimeRange('2010-07-30T00:00:00 : 2020-07-30T00:00:00')).toBe(
      '2010-07-30 ≤ col < 2020-07-30',
    );
    expect(formatTimeRange('2010-07-30T01:00:00 : ')).toBe(
      '2010-07-30T01:00:00 ≤ col < ∞',
    );
    expect(formatTimeRange(' : 2020-07-30T00:00:00')).toBe(
      '-∞ ≤ col < 2020-07-30',
    );
  });
});
