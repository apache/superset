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

import {
  ColorSchemeGroup,
  getCategoricalSchemeNames,
  getCategoricalSchemeRegistry,
  getSchemeColors,
  registerCategoricalSchemeRegistry,
} from '@apache-superset/core/colors';

// ─── ColorSchemeGroup enum ────────────────────────────────────────────────────

test('ColorSchemeGroup has the expected string values', () => {
  expect(ColorSchemeGroup.Custom).toBe('custom');
  expect(ColorSchemeGroup.Featured).toBe('featured');
  expect(ColorSchemeGroup.Other).toBe('other');
});

// ─── Registry bridge ─────────────────────────────────────────────────────────

test('getCategoricalSchemeNames returns [] before any registry is injected', () => {
  registerCategoricalSchemeRegistry({ keys: () => [], get: () => null });
  expect(getCategoricalSchemeNames()).toEqual([]);
});

test('getCategoricalSchemeNames returns alphabetically sorted names', () => {
  registerCategoricalSchemeRegistry({
    keys: () => ['zebra', 'apple', 'mango'],
    get: () => null,
  });
  expect(getCategoricalSchemeNames()).toEqual(['apple', 'mango', 'zebra']);
});

test('getSchemeColors returns the color array for a known scheme', () => {
  const colors = ['#ff0000', '#00ff00', '#0000ff'];
  registerCategoricalSchemeRegistry({
    keys: () => ['testScheme'],
    get: (name: string) =>
      name === 'testScheme' ? { id: 'testScheme', colors } : null,
  });
  expect(getSchemeColors('testScheme')).toEqual(colors);
  expect(getSchemeColors('nonexistent')).toBeNull();
});

test('getCategoricalSchemeRegistry returns the injected registry object', () => {
  const mockRegistry = { keys: () => ['a', 'b'], get: () => null };
  registerCategoricalSchemeRegistry(mockRegistry);
  expect(getCategoricalSchemeRegistry()).toBe(mockRegistry);
});
