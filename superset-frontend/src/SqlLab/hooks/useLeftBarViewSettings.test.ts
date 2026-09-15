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
import {
  applyLeftBarViewSettings,
  orderViewsBySettings,
  resetLeftBarViewSettings,
  useLeftBarViewSettings,
} from './useLeftBarViewSettings';

beforeEach(() => {
  resetLeftBarViewSettings();
});

test('orderViewsBySettings returns views unchanged when order is empty', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(orderViewsBySettings(views, [])).toEqual(views);
});

test('orderViewsBySettings orders by the given ids', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(orderViewsBySettings(views, ['c', 'a', 'b']).map(v => v.id)).toEqual([
    'c',
    'a',
    'b',
  ]);
});

test('orderViewsBySettings appends ids missing from order, preserving their relative order', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  // 'b' and 'd' are not in the order list.
  expect(orderViewsBySettings(views, ['c', 'a']).map(v => v.id)).toEqual([
    'c',
    'a',
    'b',
    'd',
  ]);
});

test('orderViewsBySettings ignores ids in order that are not present in views', () => {
  const views = [{ id: 'a' }, { id: 'b' }];
  expect(
    orderViewsBySettings(views, ['gone', 'b', 'a']).map(v => v.id),
  ).toEqual(['b', 'a']);
});

test('useLeftBarViewSettings returns the default settings when nothing is applied', () => {
  const { result } = renderHook(() => useLeftBarViewSettings());
  expect(result.current).toEqual({ order: [], hidden: [] });
});

test('applyLeftBarViewSettings updates all subscribed hook instances', () => {
  const { result: first } = renderHook(() => useLeftBarViewSettings());
  const { result: second } = renderHook(() => useLeftBarViewSettings());

  act(() => {
    applyLeftBarViewSettings({ order: ['b', 'a'], hidden: ['c'] });
  });

  expect(first.current).toEqual({ order: ['b', 'a'], hidden: ['c'] });
  expect(second.current).toEqual({ order: ['b', 'a'], hidden: ['c'] });
});

test('applyLeftBarViewSettings persists across a fresh hook subscription', () => {
  act(() => {
    applyLeftBarViewSettings({ order: ['x'], hidden: ['y'] });
  });

  const { result } = renderHook(() => useLeftBarViewSettings());
  expect(result.current).toEqual({ order: ['x'], hidden: ['y'] });
});

test('resetLeftBarViewSettings restores the default settings', () => {
  applyLeftBarViewSettings({ order: ['x'], hidden: ['y'] });

  resetLeftBarViewSettings();

  const { result } = renderHook(() => useLeftBarViewSettings());
  expect(result.current).toEqual({ order: [], hidden: [] });
});
