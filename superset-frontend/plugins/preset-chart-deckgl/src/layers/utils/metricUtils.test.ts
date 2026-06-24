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

import { getMetricLabel } from '@superset-ui/core';
import {
  isMetricValue,
  isFixedValue,
  extractMetricKey,
  getMetricLabelFromValue,
  getFixedValue,
} from './metricUtils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getMetricLabel: jest.fn((metric: string) => metric),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('isMetricValue should identify metric values correctly', () => {
  expect(isMetricValue({ type: 'metric', value: 'COUNT(*)' })).toBe(true);
  expect(isMetricValue({ type: 'fix', value: '1000' })).toBe(false);
  expect(isMetricValue('AVG(value)')).toBe(true); // legacy string format
  expect(isMetricValue(undefined)).toBe(false);
  expect(isMetricValue(null)).toBe(false);
});

test('isFixedValue should identify fixed values correctly', () => {
  expect(isFixedValue({ type: 'fix', value: '1000' })).toBe(true);
  expect(isFixedValue({ type: 'metric', value: 'COUNT(*)' })).toBe(false);
  expect(isFixedValue('AVG(value)')).toBe(false); // legacy string format
  expect(isFixedValue(undefined)).toBe(false);
  expect(isFixedValue(null)).toBe(false);
});

test('extractMetricKey should handle string values', () => {
  expect(extractMetricKey('COUNT(*)')).toBe('COUNT(*)');
  expect(extractMetricKey('')).toBe('');
});

test('extractMetricKey should handle number values', () => {
  expect(extractMetricKey(123)).toBe('123');
  expect(extractMetricKey(0)).toBe('0');
});

test('extractMetricKey should extract from object properties', () => {
  expect(extractMetricKey({ label: 'Total Sales' })).toBe('Total Sales');
  expect(extractMetricKey({ sqlExpression: 'SUM(sales)' })).toBe('SUM(sales)');
  expect(extractMetricKey({ value: 'AVG(price)' })).toBe('AVG(price)');
  expect(
    extractMetricKey({ label: 'Label', sqlExpression: 'SQL', value: 'Value' }),
  ).toBe('Label'); // priority order
});

test('extractMetricKey should handle null/undefined', () => {
  expect(extractMetricKey(null)).toBeUndefined();
  expect(extractMetricKey(undefined)).toBeUndefined();
  expect(extractMetricKey({})).toBeUndefined();
});

test('getMetricLabelFromValue should return label for metric values', () => {
  getMetricLabelFromValue({ type: 'metric', value: 'COUNT(*)' });
  expect(getMetricLabel).toHaveBeenCalledWith('COUNT(*)');

  getMetricLabelFromValue({ type: 'metric', value: { label: 'Total Sales' } });
  expect(getMetricLabel).toHaveBeenCalledWith('Total Sales');
});

test('getMetricLabelFromValue should return undefined for fixed values', () => {
  const result = getMetricLabelFromValue({ type: 'fix', value: '1000' });
  expect(result).toBeUndefined();
  expect(getMetricLabel).not.toHaveBeenCalled();
});

test('getMetricLabelFromValue should handle legacy string format', () => {
  getMetricLabelFromValue('AVG(value)');
  expect(getMetricLabel).toHaveBeenCalledWith('AVG(value)');
});

test('getFixedValue should return value for fixed types', () => {
  expect(getFixedValue({ type: 'fix', value: '1000' })).toBe('1000');
  expect(getFixedValue({ type: 'fix', value: 500 })).toBe(500);
});

test('getFixedValue should return undefined for metric types', () => {
  expect(getFixedValue({ type: 'metric', value: 'COUNT(*)' })).toBeUndefined();
});

test('getFixedValue should return undefined for string values', () => {
  expect(getFixedValue('AVG(value)')).toBeUndefined();
});

test('getFixedValue should handle object values', () => {
  expect(
    getFixedValue({ type: 'fix', value: { label: 'object' } }),
  ).toBeUndefined();
});

test('getFixedValue should handle missing values', () => {
  expect(getFixedValue({ type: 'fix' })).toBeUndefined();
  expect(getFixedValue(undefined)).toBeUndefined();
  expect(getFixedValue(null)).toBeUndefined();
});
