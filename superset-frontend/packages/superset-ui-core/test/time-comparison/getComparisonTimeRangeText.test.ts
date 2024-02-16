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

import { getComparisonTimeRangeText } from '@superset-ui/core';

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

describe('getComparisonTimeRangeText', () => {
  it('formats valid time range correctly', () => {
    const text = getComparisonTimeRangeText(adhocFilters, {});

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect(text).toBe('2004-02-16T00:00:00 - 2024-02-16T00:00:00');
  });

  it('returns empty string when there is no time range', () => {
    const emptyAdhocFilters = [] as any;
    const text = getComparisonTimeRangeText(emptyAdhocFilters, {});

    expect(text).toBe('');
  });
});
