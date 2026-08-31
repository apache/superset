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

let locationSpy: jest.SpyInstance | undefined;

afterEach(() => {
  locationSpy?.mockRestore();
});

test('returns ThemeMode.DARK when ?themeMode=dark', () => {
  locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?themeMode=dark',
  } as Location);
  expect(getInitialThemeMode()).toBe(ThemeMode.DARK);
});

test('returns ThemeMode.SYSTEM when ?themeMode=system', () => {
  locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?themeMode=system',
  } as Location);
  expect(getInitialThemeMode()).toBe(ThemeMode.SYSTEM);
});

test('returns ThemeMode.DEFAULT when ?themeMode=light', () => {
  locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?themeMode=light',
  } as Location);
  expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
});

test('returns ThemeMode.DEFAULT when no themeMode param', () => {
  locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);
  expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
});

test('returns ThemeMode.DEFAULT for an unrecognised value', () => {
  locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?themeMode=invalid',
  } as Location);
  expect(getInitialThemeMode()).toBe(ThemeMode.DEFAULT);
});
