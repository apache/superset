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
import { usePageSizeOptions } from './index';

test('returns client-side pagination options for small dataset', () => {
  const { result } = renderHook(() =>
    usePageSizeOptions({
      serverPagination: false,
      dataLength: 50,
      rowCount: 0,
    }),
  );

  expect(result.current.length).toBeGreaterThan(0);
  expect(result.current.every(([size]) => size <= 100)).toBe(true);
});

test('filters options based on data length for client pagination', () => {
  const { result } = renderHook(() =>
    usePageSizeOptions({
      serverPagination: false,
      dataLength: 10,
      rowCount: 0,
    }),
  );

  // All options should be <= 2 * dataLength (20)
  expect(result.current.every(([size]) => size <= 20)).toBe(true);
});

test('returns server-side pagination options based on row count', () => {
  const { result } = renderHook(() =>
    usePageSizeOptions({
      serverPagination: true,
      dataLength: 10,
      rowCount: 1000,
    }),
  );

  expect(result.current.length).toBeGreaterThan(0);
  expect(result.current.every(([size]) => size <= 1000)).toBe(true);
});

test('memoizes result when inputs do not change', () => {
  const { result, rerender } = renderHook(props => usePageSizeOptions(props), {
    initialProps: {
      serverPagination: false,
      dataLength: 50,
      rowCount: 0,
    },
  });

  const firstResult = result.current;

  rerender({
    serverPagination: false,
    dataLength: 50,
    rowCount: 0,
  });

  const secondResult = result.current;

  expect(firstResult).toBe(secondResult);
});

test('recalculates when data length changes', () => {
  const { result, rerender } = renderHook(props => usePageSizeOptions(props), {
    initialProps: {
      serverPagination: false,
      dataLength: 10,
      rowCount: 0,
    },
  });

  const firstResult = result.current;

  rerender({
    serverPagination: false,
    dataLength: 100,
    rowCount: 0,
  });

  const secondResult = result.current;

  expect(firstResult).not.toBe(secondResult);
});
