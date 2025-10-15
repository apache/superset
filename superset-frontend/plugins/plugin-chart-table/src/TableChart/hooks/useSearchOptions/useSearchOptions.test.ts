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
import { useSearchOptions } from './index';

const mockColumns = [
  {
    columnKey: 'name',
    sortType: 'alphanumeric',
  },
  {
    columnKey: 'age',
    sortType: 'basic',
  },
  {
    columnKey: 'email',
    sortType: 'alphanumeric',
  },
];

test('filters columns with alphanumeric sortType', () => {
  const { result } = renderHook(() => useSearchOptions(mockColumns as any));

  expect(result.current).toEqual([
    { value: 'name', label: 'name' },
    { value: 'email', label: 'email' },
  ]);
});

test('returns empty array for columns without alphanumeric sortType', () => {
  const numericColumns = [
    {
      columnKey: 'age',
      sortType: 'basic',
    },
    {
      columnKey: 'score',
      sortType: 'basic',
    },
  ];

  const { result } = renderHook(() => useSearchOptions(numericColumns as any));

  expect(result.current).toEqual([]);
});

test('does not update when columns array changes with same content', () => {
  const { result, rerender } = renderHook(
    ({ columns }) => useSearchOptions(columns),
    {
      initialProps: { columns: mockColumns as any },
    },
  );

  const firstResult = result.current;

  // Create a new array with same content
  const sameColumns = [
    {
      columnKey: 'name',
      sortType: 'alphanumeric',
    },
    {
      columnKey: 'age',
      sortType: 'basic',
    },
    {
      columnKey: 'email',
      sortType: 'alphanumeric',
    },
  ];

  rerender({ columns: sameColumns as any });

  const secondResult = result.current;

  // Should be same reference due to isEqual check
  expect(firstResult).toBe(secondResult);
});

test('updates when column content changes', () => {
  const { result, rerender } = renderHook(
    ({ columns }) => useSearchOptions(columns),
    {
      initialProps: { columns: mockColumns as any },
    },
  );

  const firstResult = result.current;

  const newColumns = [
    {
      columnKey: 'address',
      sortType: 'alphanumeric',
    },
  ];

  rerender({ columns: newColumns as any });

  const secondResult = result.current;

  expect(firstResult).not.toBe(secondResult);
  expect(secondResult).toEqual([{ value: 'address', label: 'address' }]);
});

test('handles empty columns array', () => {
  const { result } = renderHook(() => useSearchOptions([]));

  expect(result.current).toEqual([]);
});
