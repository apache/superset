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
  disableQueryCostWarning,
  getQueryCostWarning,
  getQueryCostWarningError,
  getCostWarningUnit,
  formatWarningBytes,
  parseWarningBytes,
  CostWarningUnit,
  isQueryCostWarningMetric,
  isQueryCostWarningThreshold,
} from './queryCostWarning';
import { ExtraJson } from './types';

test.each([
  ['1.000001', 'MB', 1000001],
  ['0.000001', 'MB', 1],
  ['0.000000001', 'GB', 1],
  ['1.25', 'GB', 1250000000],
  ['1e3', 'MB', 1000000000],
  ['1.00', 'Bytes', 1],
  ['9007199254740991', 'Bytes', Number.MAX_SAFE_INTEGER],
] as const)('converts %s %s to exact bytes', (amount, unit, expected) => {
  expect(parseWarningBytes(amount, unit)).toBe(expected);
});

test.each([
  ['', 'Bytes'],
  ['0', 'Bytes'],
  ['-1', 'MB'],
  ['1.5', 'Bytes'],
  ['0.0000001', 'MB'],
  ['0.0000000001', 'GB'],
  ['9007199254740992', 'Bytes'],
  ['9007199.254740992', 'GB'],
  ['1e1000000000', 'GB'],
  ['1e-1000000000', 'GB'],
  ['NaN', 'Bytes'],
  ['Infinity', 'Bytes'],
  ['garbage', 'MB'],
] as const)('rejects %s %s without rounding', (amount, unit) => {
  expect(parseWarningBytes(amount, unit)).toBeUndefined();
});

test.each<CostWarningUnit>(['Bytes', 'MB', 'GB'])(
  'displaying large byte amounts in %s preserves every byte',
  unit => {
    const formatted = formatWarningBytes(Number.MAX_SAFE_INTEGER, unit);
    expect(parseWarningBytes(formatted, unit)).toBe(Number.MAX_SAFE_INTEGER);
  },
);

test('unit selection and display never change the stored amount', () => {
  expect(getCostWarningUnit(2000000000)).toBe('GB');
  expect(formatWarningBytes(2000000000, 'MB')).toBe('2000');
  expect(formatWarningBytes(1500001, 'MB')).toBe('1.500001');
  expect(formatWarningBytes(Number.MAX_SAFE_INTEGER, 'GB')).toBe(
    '9007199.254740991',
  );
});

test('disabled rules keep valid values from a different engine', () => {
  expect(
    getQueryCostWarningError(
      { enabled: false, metric: 'bytes_processed', threshold: 100 },
      'total_cost',
    ),
  ).toBeUndefined();
  expect(
    getQueryCostWarningError(
      { enabled: true, metric: 'bytes_processed', threshold: 100 },
      'total_cost',
    ),
  ).toBeDefined();
  expect(
    getQueryCostWarningError(
      { enabled: true, metric: 'total_cost', threshold: 12.5 },
      'total_cost',
    ),
  ).toBeUndefined();
  expect(
    getQueryCostWarningError(
      { enabled: false, metric: 'bytes_processed', threshold: 0.5 },
      'bytes_processed',
    ),
  ).toBeDefined();
});

test('missing settings leave warnings off without a threshold', () => {
  expect(getQueryCostWarning({ cost_estimate_enabled: true })).toEqual({
    enabled: false,
  });
});

test.each([null, { enabled: false }, { enabled: true, threshold: 'invalid' }])(
  'reads an explicit rule without inventing missing fields (%j)',
  rule => {
    const original = rule === null ? null : { ...rule };
    const extra = { query_cost_warning: rule } as ExtraJson;
    expect(getQueryCostWarning(extra)).toEqual(original || {});
    expect(extra).toEqual({ query_cost_warning: original });
  },
);

test.each([NaN, Infinity, 0, -1, '100', true, 0.5])(
  'disabling drops invalid byte thresholds (%s)',
  threshold => {
    expect(
      disableQueryCostWarning({
        enabled: true,
        metric: 'bytes_processed',
        threshold,
      }),
    ).toEqual({ enabled: false, metric: 'bytes_processed' });
  },
);

test.each(['unknown', 'constructor', '__proto__', '', null, 1])(
  'unknown metric %s has no numeric or planner-cost default',
  metric => {
    expect(isQueryCostWarningMetric(metric)).toBe(false);
    expect(
      getQueryCostWarningError(
        { enabled: true, metric, threshold: 12.5 },
        'total_cost',
      ),
    ).toBeDefined();
  },
);

test('valid disabled unknown metrics remain distinct from invalid enabled rules', () => {
  expect(
    getQueryCostWarningError(
      { enabled: false, metric: 'unknown', threshold: 12.5 },
      'total_cost',
    ),
  ).toBeUndefined();
});

test.each([
  ['bytes_processed', 0, false],
  ['bytes_processed', 0.5, false],
  ['bytes_processed', Number.MAX_SAFE_INTEGER, true],
  ['bytes_processed', Number.MAX_SAFE_INTEGER + 1, false],
  ['bytes_processed', BigInt('9007199254740993123'), false],
  ['total_cost', 0, false],
  ['total_cost', 0.125, true],
  ['total_cost', BigInt('9007199254740993123'), true],
  ['total_cost', Infinity, false],
  ['total_cost', NaN, false],
  ['total_cost', true, false],
  ['total_cost', '12.5', false],
  ['bytes_processed', -1, false],
] as const)(
  '%s threshold %s validates without coercion or precision loss',
  (metric, value, thresholdValid) => {
    expect(isQueryCostWarningThreshold(value, metric)).toBe(thresholdValid);
  },
);
