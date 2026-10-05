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
import { act, renderHook } from '@testing-library/react';
import { CanvasDefinition } from './types';
import { useCanvasRefresh } from './useCanvasRefresh';

const definition = (
  refresh: CanvasDefinition['settings']['refresh'],
): CanvasDefinition => ({
  version: 1,
  root: { layout: { columns: 24, gap: 16, rowUnit: 40 }, children: [] },
  nodes: {
    a: { instance: 'w-a', layout: {} },
    b: { instance: 'w-b', layout: {} },
    c: { instance: 'w-c', layout: {} },
  },
  interactions: { filters: {}, crossFilters: {}, customizations: {} },
  settings: {
    refresh,
    colors: { labelColors: {} },
    display: { showTimestamps: false },
    crossFilters: { enabled: true },
  },
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('bumps every node not exempt on each interval', () => {
  const { result } = renderHook(() =>
    useCanvasRefresh(definition({ interval: 60, stagger: 0, exempt: ['c'] })),
  );

  expect(result.current).toEqual({});
  act(() => jest.advanceTimersByTime(60_000));
  expect(result.current).toEqual({ a: 1, b: 1 });
  act(() => jest.advanceTimersByTime(60_000));
  expect(result.current).toEqual({ a: 2, b: 2 });
});

test('spreads a refresh over the stagger window', () => {
  const { result } = renderHook(() =>
    useCanvasRefresh(definition({ interval: 60, stagger: 3000, exempt: [] })),
  );

  act(() => jest.advanceTimersByTime(60_000));
  expect(result.current).toEqual({ a: 1 });
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current).toEqual({ a: 1, b: 1 });
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current).toEqual({ a: 1, b: 1, c: 1 });
});

test('does nothing when refresh is off', () => {
  const { result } = renderHook(() =>
    useCanvasRefresh(definition({ interval: 0, stagger: 0, exempt: [] })),
  );

  act(() => jest.advanceTimersByTime(600_000));
  expect(result.current).toEqual({});
});
