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
import { renderHook } from '@testing-library/react-hooks';
import { DataRecord } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useValueRanges } from './index';
import { DataColumnMeta } from '../../../types';

const mockData: DataRecord[] = [
  { metric1: 10, metric2: -5, dimension1: 'A' },
  { metric1: 20, metric2: -10, dimension1: 'B' },
  { metric1: 30, metric2: 15, dimension1: 'C' },
];

const mockColumns: DataColumnMeta[] = [
  {
    key: 'metric1',
    label: 'Metric 1',
    dataType: GenericDataType.Numeric,
    isMetric: true,
    config: {},
  },
  {
    key: 'metric2',
    label: 'Metric 2',
    dataType: GenericDataType.Numeric,
    isMetric: true,
    config: {},
  },
  {
    key: 'dimension1',
    label: 'Dimension 1',
    dataType: GenericDataType.String,
    isMetric: false,
    config: {},
  },
];

test('calculates value ranges for metric columns', () => {
  const { result } = renderHook(() => useValueRanges(mockData, mockColumns));

  const { valueRanges } = result.current;

  expect(valueRanges.metric1).toEqual({
    aligned: [0, 30],
    normal: [10, 30],
  });

  expect(valueRanges.metric2).toEqual({
    aligned: [0, 15],
    normal: [-10, 15],
  });

  expect(valueRanges.dimension1).toBeUndefined();
});

test('getValueRange returns aligned range when alignPositiveNegative is true', () => {
  const { result } = renderHook(() => useValueRanges(mockData, mockColumns));

  const range = result.current.getValueRange('metric2', true);

  expect(range).toEqual([0, 15]);
});

test('getValueRange returns normal range when alignPositiveNegative is false', () => {
  const { result } = renderHook(() => useValueRanges(mockData, mockColumns));

  const range = result.current.getValueRange('metric2', false);

  expect(range).toEqual([-10, 15]);
});

test('returns null for non-existent column', () => {
  const { result } = renderHook(() => useValueRanges(mockData, mockColumns));

  const range = result.current.getValueRange('nonexistent', false);

  expect(range).toBeNull();
});

test('returns empty ranges for empty data', () => {
  const { result } = renderHook(() => useValueRanges([], mockColumns));

  const { valueRanges } = result.current;

  expect(Object.keys(valueRanges)).toHaveLength(0);
});

test('handles percent metric columns', () => {
  const percentColumn: DataColumnMeta = {
    key: 'percent_metric',
    label: 'Percent Metric',
    dataType: GenericDataType.Numeric,
    isMetric: false,
    isPercentMetric: true,
    config: {},
  };

  const dataWithPercent: DataRecord[] = [
    { percent_metric: 0.1 },
    { percent_metric: 0.5 },
    { percent_metric: 0.9 },
  ];

  const { result } = renderHook(() =>
    useValueRanges(dataWithPercent, [percentColumn]),
  );

  const { valueRanges } = result.current;

  expect(valueRanges.percent_metric).toBeDefined();
  expect(valueRanges.percent_metric?.normal).toEqual([0.1, 0.9]);
});

test('returns null for columns with missing values', () => {
  const dataWithMissing: DataRecord[] = [
    { metric1: 10 },
    { metric1: null },
    { metric1: 30 },
  ];

  const { result } = renderHook(() =>
    useValueRanges(dataWithMissing, mockColumns),
  );

  const range = result.current.getValueRange('metric1', false);

  expect(range).toBeNull();
});

test('memoizes value ranges correctly', () => {
  const { result, rerender } = renderHook(
    ({ data, columns }) => useValueRanges(data, columns),
    {
      initialProps: { data: mockData, columns: mockColumns },
    },
  );

  const firstRanges = result.current.valueRanges;

  rerender({ data: mockData, columns: mockColumns });

  const secondRanges = result.current.valueRanges;

  expect(firstRanges).toBe(secondRanges);
});

test('recalculates when data changes', () => {
  const { result, rerender } = renderHook(
    ({ data, columns }) => useValueRanges(data, columns),
    {
      initialProps: { data: mockData, columns: mockColumns },
    },
  );

  const firstRanges = result.current.valueRanges;

  const newData = [
    { metric1: 100, metric2: 200, dimension1: 'D' },
    { metric1: 150, metric2: 250, dimension1: 'E' },
  ];

  rerender({ data: newData, columns: mockColumns });

  const secondRanges = result.current.valueRanges;

  expect(firstRanges).not.toBe(secondRanges);
  expect(secondRanges.metric1?.normal).toEqual([100, 150]);
});
