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
  useNativeFiltersStore,
  useDashboardInfoStore,
  type FilterEntry,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { setInScopeStatusOfCustomizations } from './inScopeStatus';

// setInScopeStatusOfCustomizations reads the filter config from the
// native-filters Zustand store and dashboardInfo (metadata) from the
// dashboardInfo store, then writes the merged config back.
const getMergedConfig = () =>
  useDashboardInfoStore.getState().dashboardInfo.metadata
    ?.chart_customization_config as {
    id: string;
    chartsInScope: number[];
    tabsInScope: string[];
  }[];

function seed(
  filters: Record<string, FilterEntry>,
  metadata: Record<string, unknown>,
) {
  useNativeFiltersStore.setState({ filters });
  useDashboardInfoStore.setState({
    dashboardInfo: { metadata } as unknown as DashboardInfo,
  });
}

test('filters null entries from chart_customization_config', () => {
  seed(
    {
      'CUSTOM-1': {
        id: 'CUSTOM-1',
        name: 'Group By',
        chartsInScope: [],
      } as unknown as FilterEntry,
    },
    {
      chart_customization_config: [
        null,
        { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [] },
        null,
      ],
    },
  );

  setInScopeStatusOfCustomizations([
    {
      customizationId: 'CUSTOM-1',
      chartsInScope: [10, 20],
      tabsInScope: ['TAB-A'],
    },
  ]);

  // The matching filter's scope is written to the native-filters store.
  expect(
    useNativeFiltersStore.getState().filters['CUSTOM-1']?.chartsInScope,
  ).toEqual([10, 20]);

  // The merged config is written to the dashboardInfo store (nulls stripped).
  const updatedConfig = getMergedConfig();
  expect(updatedConfig).toHaveLength(1);
  expect(updatedConfig[0].id).toBe('CUSTOM-1');
  expect(updatedConfig[0].chartsInScope).toEqual([10, 20]);
  expect(updatedConfig[0].tabsInScope).toEqual(['TAB-A']);
});

test('filters undefined entries from chart_customization_config', () => {
  seed(
    {
      'CUSTOM-1': {
        id: 'CUSTOM-1',
        name: 'Group By',
        chartsInScope: [],
      } as unknown as FilterEntry,
    },
    {
      chart_customization_config: [
        undefined,
        { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [] },
        undefined,
      ],
    },
  );

  setInScopeStatusOfCustomizations([
    {
      customizationId: 'CUSTOM-1',
      chartsInScope: [10, 20],
      tabsInScope: ['TAB-A'],
    },
  ]);

  const updatedConfig = getMergedConfig();
  expect(updatedConfig).toHaveLength(1);
  expect(updatedConfig[0].id).toBe('CUSTOM-1');
  expect(updatedConfig[0].chartsInScope).toEqual([10, 20]);
});

test('handles config that is entirely null entries', () => {
  seed({}, { chart_customization_config: [null, null] });
  setInScopeStatusOfCustomizations([
    { customizationId: 'CUSTOM-MISSING', chartsInScope: [10], tabsInScope: [] },
  ]);
  expect(getMergedConfig()).toHaveLength(0);
});

test('works with undefined metadata', () => {
  seed({}, undefined as unknown as Record<string, unknown>);
  setInScopeStatusOfCustomizations([
    { customizationId: 'CUSTOM-1', chartsInScope: [10], tabsInScope: [] },
  ]);
  expect(getMergedConfig()).toHaveLength(0);
});
