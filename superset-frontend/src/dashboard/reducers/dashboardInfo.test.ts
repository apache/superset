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
  DASHBOARD_INFO_UPDATED,
  dashboardInfoChanged,
} from '../actions/dashboardInfo';
import type { DashboardInfo } from '../types';
import dashboardInfoReducer from './dashboardInfo';

const existingTheme = {
  id: 99,
  theme_name: 'Corporate Theme',
  json_data: '{"token":{"colorPrimary":"#003366"}}',
};

const stateWithTheme = {
  id: 1,
  theme: existingTheme,
  slug: 'test-dash',
  metadata: {},
} as Partial<DashboardInfo>;

test('preserves existing theme when DASHBOARD_INFO_UPDATED payload omits theme key', () => {
  // Simulates the fixed Header behavior: conditional spread omits `theme`
  // key when PropertiesModal returns theme: undefined (theme not in fetched list).
  const action = dashboardInfoChanged({ slug: 'new-slug' });
  const result = dashboardInfoReducer(stateWithTheme, action);

  expect(result.theme).toBe(existingTheme);
  expect(result.slug).toBe('new-slug');

  // themeId derivation (Header line 299) should produce the original ID
  const themeId = result.theme ? result.theme.id : null;
  expect(themeId).toBe(99);
});

test('clears theme when DASHBOARD_INFO_UPDATED payload has theme: null', () => {
  // Simulates intentional theme removal via Properties modal.
  const action = dashboardInfoChanged({ theme: null });
  const result = dashboardInfoReducer(stateWithTheme, action);

  expect(result.theme).toBeNull();

  const themeId = result.theme ? result.theme.id : null;
  expect(themeId).toBeNull();
});

test('overwrites theme when DASHBOARD_INFO_UPDATED payload has theme: undefined', () => {
  // Documents the dangerous behavior that the Header conditional spread prevents.
  // If `theme: undefined` leaks into the action payload, the reducer WILL overwrite
  // the existing theme — this is why Header must omit the key entirely.
  const action = {
    type: DASHBOARD_INFO_UPDATED,
    newInfo: { theme: undefined },
  };
  const result = dashboardInfoReducer(stateWithTheme, action);

  // theme is overwritten to undefined — save would compute themeId as null
  expect(result.theme).toBeUndefined();
  const themeId = result.theme ? result.theme.id : null;
  expect(themeId).toBeNull();
});
