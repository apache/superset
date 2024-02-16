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

  it('handles specific time range lookup patterns', () => {
    const patterns = [
      'last day',
      'last 2 weeks',
      'next 3 months',
      'previous calendar month',
      'previous calendar year',
      'DATEADD(DATETIME("now"), 1, day)',
      'DATEADD(DATETIME("2024-02-01"), 1, day)',
      'DATEADD(DATETIME("invalid"), 1, day)',
      'now',
      'previous calendar week',
      'next week',
      'last week',
    ];
    patterns.forEach(pattern => {
      const extraFormData = { time_range: pattern };
      const result = getComparisonTimeRangeInfo(adhocFilters, extraFormData);
      expect(result.timeRange).toBe(pattern);
    });
  });

  it('returns null for No filter', () => {
    const extraFormData = { time_range: 'No filter' };
    const result = getComparisonTimeRangeInfo(adhocFilters, extraFormData);
    expect(result.since?.isValid()).toBeFalsy();
    expect(result.until?.isValid()).toBeFalsy();
  });

  it('returns null for 40 years ago', () => {
    // TODO: Handle Human readable Formats and assert with it
    const extraFormData = { time_range: '40 years ago' };
    const result = getComparisonTimeRangeInfo(adhocFilters, extraFormData);
    expect(result.since?.isValid()).toBeFalsy();
    expect(result.until?.isValid()).toBeFalsy();
  });

  it('throws an error when since date is after until date', () => {
    const extraFormData = { time_range: '2024-02-16 : 2004-02-16' };
    expect(() => {
      getComparisonTimeRangeInfo(adhocFilters, extraFormData);
    }).toThrow('From date cannot be larger than to date');
  });

  it('Code doesnt break if adhoc_filter is undefined', () => {
    const result = getComparisonTimeRangeInfo(undefined as any, {});
    expect(result.since).toBeNull();
    expect(result.until).toBeNull();
  });
});
