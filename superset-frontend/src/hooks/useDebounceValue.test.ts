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

import { act, renderHook } from '@testing-library/react-hooks';
import { useDebounceValue } from './useDebounceValue';

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('should return the initial value', () => {
  const { result } = renderHook(() => useDebounceValue('hello'));
  expect(result.current).toBe('hello');
});

test('should update debounced value after delay', async () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value, delay }) => useDebounceValue(value, delay),
    { initialProps: { value: 'hello', delay: 1000 } },
  );

  expect(result.current).toBe('hello');
  act(() => {
    rerender({ value: 'world', delay: 1000 });
    jest.advanceTimersByTime(500);
  });

  expect(result.current).toBe('hello');

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(result.current).toBe('world');
});

it('should cancel previous timeout when value changes', async () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value, delay }) => useDebounceValue(value, delay),
    { initialProps: { value: 'hello', delay: 1000 } },
  );

  expect(result.current).toBe('hello');
  rerender({ value: 'world', delay: 1000 });

  jest.advanceTimersByTime(500);
  rerender({ value: 'foo', delay: 1000 });

  jest.advanceTimersByTime(500);
  expect(result.current).toBe('hello');
});

test('should cancel the timeout when unmounting', async () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useDebounceValue('hello', 1000));

  expect(result.current).toBe('hello');
  unmount();

  jest.advanceTimersByTime(1000);
  expect(clearTimeout).toHaveBeenCalled();
});
