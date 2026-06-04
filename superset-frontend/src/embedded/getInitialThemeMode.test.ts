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
import { ThemeMode } from '@apache-superset/core/theme';
import { getInitialThemeMode } from './getInitialThemeMode';

describe('getInitialThemeMode', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search },
      writable: true,
    });
  }

  test('returns ThemeMode.DARK when ?theme=dark', () => {
    setSearch('?theme=dark');
    expect(getInitialThemeMode()).toBe(ThemeMode.DARK);
  });

  test('returns ThemeMode.SYSTEM when ?theme=system', () => {
    setSearch('?theme=system');
    expect(getInitialThemeMode()).toBe(ThemeMode.SYSTEM);
  });

  test('returns ThemeMode.DEFAULT when ?theme=light', () => {
    setSearch('?theme=light');
    expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
  });

  test('returns ThemeMode.DEFAULT when no theme param', () => {
    setSearch('');
    expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
  });

  test('returns ThemeMode.DEFAULT for an unrecognised value', () => {
    setSearch('?theme=invalid');
    expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
  });
});
