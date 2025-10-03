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
import { useTableResize } from './index';

test('initializes tableSize based on width and height props', () => {
  const { result } = renderHook(() =>
    useTableResize({ width: 800, height: 600 }),
  );

  expect(result.current.tableSize.width).toBeGreaterThan(0);
  expect(result.current.tableSize.height).toBeGreaterThan(0);
});

test('provides handleSizeChange callback', () => {
  const { result } = renderHook(() =>
    useTableResize({ width: 800, height: 600 }),
  );

  expect(typeof result.current.handleSizeChange).toBe('function');
});

test('updates tableSize when width prop increases', () => {
  const { result, rerender } = renderHook(
    ({ width, height }) => useTableResize({ width, height }),
    { initialProps: { width: 800, height: 600 } },
  );

  const initialWidth = result.current.tableSize.width;

  rerender({ width: 1000, height: 600 });

  expect(result.current.tableSize.width).toBeGreaterThan(initialWidth);
});

test('updates tableSize when height prop increases', () => {
  const { result, rerender } = renderHook(
    ({ width, height }) => useTableResize({ width, height }),
    { initialProps: { width: 800, height: 600 } },
  );

  const initialHeight = result.current.tableSize.height;

  rerender({ width: 800, height: 800 });

  expect(result.current.tableSize.height).toBeGreaterThan(initialHeight);
});

test('updates tableSize when both width and height props change', () => {
  const { result, rerender } = renderHook(
    ({ width, height }) => useTableResize({ width, height }),
    { initialProps: { width: 800, height: 600 } },
  );

  rerender({ width: 1000, height: 800 });

  expect(result.current.tableSize.width).toBeGreaterThan(0);
  expect(result.current.tableSize.height).toBeGreaterThan(0);
});

test('maintains stable handleSizeChange reference', () => {
  const { result, rerender } = renderHook(
    ({ width, height }) => useTableResize({ width, height }),
    { initialProps: { width: 800, height: 600 } },
  );

  const firstCallback = result.current.handleSizeChange;

  rerender({ width: 900, height: 700 });

  const secondCallback = result.current.handleSizeChange;

  expect(firstCallback).toBe(secondCallback);
});
