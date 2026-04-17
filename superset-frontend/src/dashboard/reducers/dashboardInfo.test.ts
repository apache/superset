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
import { CLEAR_ALL_CHART_CUSTOMIZATIONS } from '../actions/chartCustomizationActions';
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

const stateWithScopes = {
  id: 1,
  metadata: {
    native_filter_configuration: [
      {
        id: 'FILTER-1',
        name: 'Region',
        chartsInScope: [10, 20, 30],
        tabsInScope: ['TAB-A'],
        targets: [{ datasetId: 1 }],
      },
      {
        id: 'FILTER-2',
        name: 'Date Range',
        chartsInScope: [40],
        tabsInScope: [],
        targets: [{ datasetId: 2 }],
      },
    ],
    chart_customization_config: [
      {
        id: 'CUSTOM-1',
        chartsInScope: [100],
        tabsInScope: ['TAB-X'],
      },
    ],
  },
} as unknown as Partial<DashboardInfo>;

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

test('preserves native_filter_configuration scopes during DASHBOARD_INFO_UPDATED metadata refresh', () => {
  // Simulates the save flow: onUpdateSuccess → setDashboardMetadata(serverMetadata)
  // → dashboardInfoChanged({ metadata: ... }) → DASHBOARD_INFO_UPDATED.
  // The server response contains filters WITHOUT chartsInScope/tabsInScope (client-only).
  const serverMetadata = {
    native_filter_configuration: [
      { id: 'FILTER-1', name: 'Region (updated)', targets: [{ datasetId: 1 }] },
      { id: 'FILTER-2', name: 'Date Range', targets: [{ datasetId: 2 }] },
    ],
  } as unknown as DashboardInfo['metadata'];

  const action = dashboardInfoChanged({ metadata: serverMetadata });
  const result = dashboardInfoReducer(stateWithScopes, action);

  const filters = result.metadata?.native_filter_configuration;
  expect(filters).toHaveLength(2);

  // FILTER-1: server updated the name, scopes preserved from existing state
  expect(filters![0].name).toBe('Region (updated)');
  expect(filters![0].chartsInScope).toEqual([10, 20, 30]);
  expect(filters![0].tabsInScope).toEqual(['TAB-A']);

  // FILTER-2: unchanged, scopes preserved
  expect(filters![1].chartsInScope).toEqual([40]);
  expect(filters![1].tabsInScope).toEqual([]);
});

test('preserves chart_customization_config scopes during DASHBOARD_INFO_UPDATED metadata refresh', () => {
  const serverMetadata = {
    chart_customization_config: [{ id: 'CUSTOM-1' }],
  } as unknown as DashboardInfo['metadata'];

  const action = dashboardInfoChanged({ metadata: serverMetadata });
  const result = dashboardInfoReducer(stateWithScopes, action);

  const customizations = result.metadata?.chart_customization_config;
  expect(customizations).toHaveLength(1);
  expect(customizations![0].chartsInScope).toEqual([100]);
  expect(customizations![0].tabsInScope).toEqual(['TAB-X']);
});

test('does not affect metadata when DASHBOARD_INFO_UPDATED has no metadata key', () => {
  const action = dashboardInfoChanged({ slug: 'new-slug' });
  const result = dashboardInfoReducer(stateWithScopes, action);

  // Metadata untouched — same reference
  expect(result.metadata).toBe(stateWithScopes.metadata);
});

test('preserveScopes filters out null entries from both existing and incoming config', () => {
  const stateWithNulls = {
    id: 1,
    metadata: {
      native_filter_configuration: [
        null,
        {
          id: 'FILTER-1',
          name: 'Region',
          chartsInScope: [10, 20],
          tabsInScope: ['TAB-A'],
          targets: [{ datasetId: 1 }],
        },
      ],
      chart_customization_config: [
        null,
        {
          id: 'CUSTOM-1',
          chartsInScope: [100],
          tabsInScope: ['TAB-X'],
        },
      ],
    },
  } as unknown as Partial<DashboardInfo>;

  const serverMetadata = {
    native_filter_configuration: [
      null,
      { id: 'FILTER-1', name: 'Region (updated)', targets: [{ datasetId: 1 }] },
    ],
    chart_customization_config: [null, { id: 'CUSTOM-1' }],
  } as unknown as DashboardInfo['metadata'];

  const action = dashboardInfoChanged({ metadata: serverMetadata });
  const result = dashboardInfoReducer(stateWithNulls, action);

  const filters = result.metadata?.native_filter_configuration;
  expect(filters).toHaveLength(1);
  expect(filters![0].id).toBe('FILTER-1');
  expect(filters![0].chartsInScope).toEqual([10, 20]);

  const customizations = result.metadata?.chart_customization_config;
  expect(customizations).toHaveLength(1);
  expect(customizations![0].id).toBe('CUSTOM-1');
  expect(customizations![0].chartsInScope).toEqual([100]);
});

test('CLEAR_ALL_CHART_CUSTOMIZATIONS filters out null entries before mapping', () => {
  const stateWithNullConfig = {
    id: 1,
    metadata: {
      chart_customization_config: [
        null,
        {
          id: 'CUSTOM-1',
          targets: [{ datasetId: 1, column: { name: 'status' } }],
          chartsInScope: [10],
        },
        null,
      ],
    },
  } as unknown as Partial<DashboardInfo>;

  const action = { type: CLEAR_ALL_CHART_CUSTOMIZATIONS };
  const result = dashboardInfoReducer(stateWithNullConfig, action);

  const config = result.metadata?.chart_customization_config;
  expect(config).toHaveLength(1);
  expect(config![0].id).toBe('CUSTOM-1');
  expect(config![0].targets).toEqual([{ datasetId: 1 }]);
});
