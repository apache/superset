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
import { renderHook } from '@testing-library/react';
import { GenericDataType } from '@apache-superset/core/common';
import {
  formatColumnHeader,
  useGridColumns,
} from '../components/useGridResultTable';

const colnames = ['region', 'sum__num', 'sum__num__contribution'];
const coltypes = [
  GenericDataType.String,
  GenericDataType.Numeric,
  GenericDataType.Numeric,
];
const data = [{ region: 'North', sum__num: 42, sum__num__contribution: 0.5 }];

const headerNames = (collabels: string[] | undefined) =>
  renderHook(() =>
    useGridColumns(colnames, coltypes, collabels, data),
  ).result.current.map(column => column.headerName);

test('uses the backend labels as header names', () => {
  expect(
    headerNames(['Region', 'Yearly Total', 'Yearly Total__contribution']),
  ).toEqual(['Region', 'Yearly Total', 'Yearly Total (contribution)']);
});

test('falls back to the column name when labels are missing', () => {
  expect(headerNames(undefined)).toEqual([
    'region',
    'sum__num',
    'sum__num (contribution)',
  ]);
});

test('falls back to the column name for short or empty label entries', () => {
  expect(headerNames(['', 'Yearly Total'])).toEqual([
    'region',
    'Yearly Total',
    'sum__num (contribution)',
  ]);
});

test('keeps labels aligned when a column is absent from the data', () => {
  const { result } = renderHook(() =>
    useGridColumns(
      ['missing', 'region'],
      [GenericDataType.Numeric, GenericDataType.String],
      ['Missing', 'Region'],
      [{ region: 'North' }],
    ),
  );
  expect(
    result.current.map(column => [column.label, column.headerName]),
  ).toEqual([['region', 'Region']]);
});

test('formatColumnHeader unwraps JSON-encoded metrics', () => {
  expect(formatColumnHeader('{"label": "Custom Metric"}__contribution')).toBe(
    'Custom Metric (contribution)',
  );
});
