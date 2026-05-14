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
import { previewThemeStore } from './previewThemeStore';

afterEach(() => {
  // Defensive — module-level state would leak between tests otherwise.
  previewThemeStore.clear('CHART-a');
  previewThemeStore.clear('CHART-b');
});

test('get returns undefined for unknown layoutId', () => {
  expect(previewThemeStore.get('CHART-a')).toBeUndefined();
});

test('set stores a numeric preview readable by get', () => {
  previewThemeStore.set('CHART-a', 7);
  expect(previewThemeStore.get('CHART-a')).toBe(7);
});

test('set stores explicit null (distinct from "no preview")', () => {
  previewThemeStore.set('CHART-a', null);
  expect(previewThemeStore.get('CHART-a')).toBeNull();
  // Distinct from the unknown-key case
  expect(previewThemeStore.get('CHART-b')).toBeUndefined();
});

test('clear removes the entry; subsequent get returns undefined', () => {
  previewThemeStore.set('CHART-a', 7);
  previewThemeStore.clear('CHART-a');
  expect(previewThemeStore.get('CHART-a')).toBeUndefined();
});

test('subscribers fire on set and clear, do not fire on no-op set', () => {
  const listener = jest.fn();
  const unsubscribe = previewThemeStore.subscribe(listener);
  previewThemeStore.set('CHART-a', 7);
  previewThemeStore.set('CHART-a', 7); // no-op (same value)
  previewThemeStore.set('CHART-a', 9);
  previewThemeStore.clear('CHART-a');
  previewThemeStore.clear('CHART-a'); // no-op
  unsubscribe();
  previewThemeStore.set('CHART-a', 1); // not observed (unsubscribed)
  expect(listener).toHaveBeenCalledTimes(3);
});

test('multiple layoutIds are tracked independently', () => {
  previewThemeStore.set('CHART-a', 1);
  previewThemeStore.set('CHART-b', 2);
  expect(previewThemeStore.get('CHART-a')).toBe(1);
  expect(previewThemeStore.get('CHART-b')).toBe(2);
  previewThemeStore.clear('CHART-a');
  expect(previewThemeStore.get('CHART-a')).toBeUndefined();
  expect(previewThemeStore.get('CHART-b')).toBe(2);
});
