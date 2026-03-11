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
import { getMetricLabelFromFormData, parseMetricValue } from './transformUtils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getMetricLabel: jest.fn((metric: string) => metric),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('getMetricLabelFromFormData should return undefined for undefined input', () => {
  const result = getMetricLabelFromFormData(undefined);
  expect(result).toBeUndefined();
});

test('getMetricLabelFromFormData should return undefined for null input', () => {
  const result = getMetricLabelFromFormData(null as any);
  expect(result).toBeUndefined();
});

test('getMetricLabelFromFormData should handle string metric directly', () => {
  const result = getMetricLabelFromFormData('AVG(value)');
  expect(result).toBe('AVG(value)');
  expect(getMetricLabel).toHaveBeenCalledWith('AVG(value)');
});

test('getMetricLabelFromFormData should return undefined for fixed type', () => {
  const result = getMetricLabelFromFormData({
    type: 'fix',
    value: '1000',
  });
  expect(result).toBeUndefined();
  expect(getMetricLabel).not.toHaveBeenCalled();
});

test('getMetricLabelFromFormData should return undefined for fixed type with numeric value', () => {
  const result = getMetricLabelFromFormData({
    type: 'fix',
    value: 1000,
  });
  expect(result).toBeUndefined();
  expect(getMetricLabel).not.toHaveBeenCalled();
});

test('getMetricLabelFromFormData should return metric label for metric type with string value', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
    value: 'SUM(amount)',
  });
  expect(result).toBe('SUM(amount)');
  expect(getMetricLabel).toHaveBeenCalledWith('SUM(amount)');
});

test('getMetricLabelFromFormData should handle object metric values', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
    value: {
      label: 'Total Sales',
      sqlExpression: 'SUM(sales)',
    },
  });
  expect(result).toBe('Total Sales');
  expect(getMetricLabel).toHaveBeenCalledWith('Total Sales');
});

test('getMetricLabelFromFormData should use sqlExpression if label is missing', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
    value: {
      sqlExpression: 'COUNT(*)',
    },
  });
  expect(result).toBe('COUNT(*)');
  expect(getMetricLabel).toHaveBeenCalledWith('COUNT(*)');
});

test('getMetricLabelFromFormData should use value field as fallback', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
    value: {
      value: 'AVG(price)',
    },
  });
  expect(result).toBe('AVG(price)');
  expect(getMetricLabel).toHaveBeenCalledWith('AVG(price)');
});

test('getMetricLabelFromFormData should handle metric type with numeric value', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
    value: 123,
  });
  expect(result).toBe('123');
  expect(getMetricLabel).toHaveBeenCalledWith('123');
});

test('getMetricLabelFromFormData should return undefined for object without type', () => {
  const result = getMetricLabelFromFormData({
    value: 'AVG(value)',
  });
  expect(result).toBeUndefined();
});

test('getMetricLabelFromFormData should return undefined for empty object', () => {
  const result = getMetricLabelFromFormData({});
  expect(result).toBeUndefined();
});

test('getMetricLabelFromFormData should return undefined for metric type without value', () => {
  const result = getMetricLabelFromFormData({
    type: 'metric',
  });
  expect(result).toBeUndefined();
});

test('parseMetricValue should parse numeric strings', () => {
  expect(parseMetricValue('123')).toBe(123);
  expect(parseMetricValue('123.45')).toBe(123.45);
  expect(parseMetricValue('0')).toBe(0);
  expect(parseMetricValue('-123')).toBe(-123);
});

test('parseMetricValue should handle numbers directly', () => {
  expect(parseMetricValue(123)).toBe(123);
  expect(parseMetricValue(123.45)).toBe(123.45);
  expect(parseMetricValue(0)).toBe(0);
  expect(parseMetricValue(-123)).toBe(-123);
});

test('parseMetricValue should return undefined for null', () => {
  expect(parseMetricValue(null)).toBeUndefined();
});

test('parseMetricValue should return undefined for undefined', () => {
  expect(parseMetricValue(undefined)).toBeUndefined();
});

test('parseMetricValue should return undefined for non-numeric strings', () => {
  expect(parseMetricValue('abc')).toBeUndefined();
  expect(parseMetricValue('12a34')).toBe(12); // parseFloat returns 12
  expect(parseMetricValue('')).toBeUndefined();
});

test('parseMetricValue should handle edge cases', () => {
  expect(parseMetricValue('Infinity')).toBe(Infinity);
  expect(parseMetricValue('-Infinity')).toBe(-Infinity);
  expect(parseMetricValue('NaN')).toBeUndefined();
});

test('parseMetricValue should handle boolean values', () => {
  expect(parseMetricValue(true as any)).toBeUndefined();
  expect(parseMetricValue(false as any)).toBeUndefined();
});

test('parseMetricValue should handle objects', () => {
  expect(parseMetricValue({} as any)).toBeUndefined();
  expect(parseMetricValue({ value: 123 } as any)).toBeUndefined();
});

test('parseMetricValue should handle arrays', () => {
  expect(parseMetricValue([] as any)).toBeUndefined();
  expect(parseMetricValue([123] as any)).toBe(123); // String([123]) = '123'
});
