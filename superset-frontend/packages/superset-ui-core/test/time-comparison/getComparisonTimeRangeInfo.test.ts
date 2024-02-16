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

import { getComparisonTimeRangeInfo } from '@superset-ui/core';
import moment from 'moment';

const adhocFilters = [
  {
    clause: 'WHERE',
    comparator: '2004-02-16 : 2024-02-16',
    datasourceWarning: false,
    expressionType: 'SIMPLE',
    filterOptionName: 'filter_8274fo9pogn_ihi8x28o7a',
    isExtra: false,
    isNew: false,
    operator: 'TEMPORAL_RANGE',
    sqlExpression: null,
    subject: 'order_date',
  } as any,
];

describe('getComparisonTimeRangeInfo', () => {
  it('extracts time range info correctly from adhoc filters', () => {
    const result = getComparisonTimeRangeInfo(adhocFilters, {});
    const expectedSinceDate = moment
      .utc('2004-02-16T00:00:00Z')
      .format('YYYY-MM-DD');
    const expectedUntilDate = moment
      .utc('2024-02-16T00:00:00Z')
      .format('YYYY-MM-DD');

    expect(result.timeRange).toBe('2004-02-16 : 2024-02-16');
    expect(result.since).toBeDefined();
    expect(result.until).toBeDefined();
    expect(result.since).toBeInstanceOf(moment);
    expect(result.until).toBeInstanceOf(moment);
    expect(result.since?.utc().format('YYYY-MM-DD')).toBe(expectedSinceDate);
    expect(result.until?.utc().format('YYYY-MM-DD')).toBe(expectedUntilDate);
  });
  // It extracts the right results when extra form data is given
  it('extracts the right results when extra form data is given', () => {
    const extraFormData = {
      time_range: '2005-02-16 : 2023-02-16',
    };

    const result = getComparisonTimeRangeInfo(adhocFilters, extraFormData);
    const expectedSinceDate = moment
      .utc('2005-02-16T00:00:00Z')
      .format('YYYY-MM-DD');
    const expectedUntilDate = moment
      .utc('2023-02-16T00:00:00Z')
      .format('YYYY-MM-DD');

    expect(result.timeRange).toBe('2005-02-16 : 2023-02-16');
    expect(result.since).toBeDefined();
    expect(result.until).toBeDefined();
    expect(result.since).toBeInstanceOf(moment);
    expect(result.until).toBeInstanceOf(moment);
    expect(result.since?.utc().format('YYYY-MM-DD')).toBe(expectedSinceDate);
    expect(result.until?.utc().format('YYYY-MM-DD')).toBe(expectedUntilDate);
  });
  it('handles invalid time ranges gracefully', () => {
    const wrongAdhocFilters = [
      {
        clause: 'WHERE',
        comparator: 'Invalid Time range',
        operator: 'TEMPORAL_RANGE',
        subject: 'order_date',
      } as any,
    ];

    const result = getComparisonTimeRangeInfo(wrongAdhocFilters, {});
    expect(result).toBeDefined();
    expect(result.timeRange).toBe('invalid time range');
    expect(result.since?.isValid()).toBeFalsy();
    expect(result.until?.isValid()).toBeFalsy();
  });
});
