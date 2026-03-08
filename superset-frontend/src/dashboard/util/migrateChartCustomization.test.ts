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
import { ChartCustomizationType } from '@superset-ui/core';
import { ChartCustomizationPlugins } from 'src/constants';
import {
  isLegacyChartCustomizationFormat,
  migrateChartCustomization,
  migrateChartCustomizationArray,
} from './migrateChartCustomization';
import { DASHBOARD_ROOT_ID } from './constants';

test('isLegacyChartCustomizationFormat detects legacy format', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
    },
  };
  expect(isLegacyChartCustomizationFormat(legacy)).toBe(true);
});

test('isLegacyChartCustomizationFormat rejects new format', () => {
  const newFormat = {
    id: 'CUSTOMIZATION-1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Test',
    filterType: ChartCustomizationPlugins.DynamicGroupBy,
    targets: [],
  };
  expect(isLegacyChartCustomizationFormat(newFormat)).toBe(false);
});

test('isLegacyChartCustomizationFormat rejects null', () => {
  expect(isLegacyChartCustomizationFormat(null)).toBe(false);
});

test('isLegacyChartCustomizationFormat rejects undefined', () => {
  expect(isLegacyChartCustomizationFormat(undefined)).toBe(false);
});

test('isLegacyChartCustomizationFormat rejects string', () => {
  expect(isLegacyChartCustomizationFormat('string')).toBe(false);
});

test('isLegacyChartCustomizationFormat rejects empty object', () => {
  expect(isLegacyChartCustomizationFormat({})).toBe(false);
});

test('migrateChartCustomization handles basic legacy format', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    chartId: 123,
    customization: {
      name: 'Country Filter',
      dataset: 1,
      column: 'country',
      sortAscending: true,
      sortMetric: 'count',
      canSelectMultiple: true,
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.id).toBe('CUSTOMIZATION-1');
  expect(result.type).toBe(ChartCustomizationType.ChartCustomization);
  expect(result.name).toBe('Country Filter');
  expect(result.filterType).toBe(ChartCustomizationPlugins.DynamicGroupBy);
  expect(result.targets).toEqual([
    {
      datasetId: 1,
      column: { name: 'country' },
    },
  ]);
  expect(result.scope).toEqual({
    rootPath: [DASHBOARD_ROOT_ID],
    excluded: [],
  });
  expect(result.chartsInScope).toEqual([123]);
  expect(result.tabsInScope).toBeUndefined();
  expect(result.cascadeParentIds).toEqual([]);
  expect(result.controlValues).toEqual({
    sortAscending: true,
    sortMetric: 'count',
    canSelectMultiple: true,
  });
});

test('migrateChartCustomization handles dataset as string', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: '42',
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].datasetId).toBe(42);
});

test('migrateChartCustomization handles dataset as object', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: {
        value: 42,
        label: 'My Dataset',
        table_name: 'my_table',
      },
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].datasetId).toBe(42);
});

test('migrateChartCustomization handles dataset object with string value', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: {
        value: '99',
        label: 'My Dataset',
      },
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].datasetId).toBe(99);
});

test('migrateChartCustomization handles column as array', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: ['country', 'region'],
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].column?.name).toBe('country');
});

test('migrateChartCustomization handles empty column array', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: [],
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].column?.name).toBe('');
});

test('migrateChartCustomization handles missing chartId', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.chartsInScope).toBeUndefined();
});

test('migrateChartCustomization uses title as fallback for name', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    title: 'Fallback Title',
    customization: {
      name: '',
      dataset: 1,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.name).toBe('Fallback Title');
});

test('migrateChartCustomization prefers customization.name over title', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    title: 'Fallback Title',
    customization: {
      name: 'Primary Name',
      dataset: 1,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.name).toBe('Primary Name');
});

test('migrateChartCustomization enhances defaultDataMask with groupby', () => {
  const dataMask = {
    extraFormData: { filters: [] },
    filterState: { value: ['USA'] },
  };
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
      defaultDataMask: dataMask,
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.defaultDataMask).toEqual({
    extraFormData: {
      filters: [],
      custom_form_data: {
        groupby: ['USA'],
      },
    },
    filterState: {
      value: ['USA'],
      label: 'USA',
    },
  });
});

test('migrateChartCustomization provides default dataMask when missing', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.defaultDataMask).toEqual({
    extraFormData: {},
    filterState: {},
  });
});

test('migrateChartCustomization merges controlValues', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
      sortAscending: false,
      controlValues: {
        enableEmptyFilter: true,
        customSetting: 'value',
      },
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.controlValues).toEqual({
    sortAscending: false,
    sortMetric: undefined,
    canSelectMultiple: undefined,
    enableEmptyFilter: true,
    customSetting: 'value',
  });
});

test('migrateChartCustomization preserves removed flag', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    removed: true,
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.removed).toBe(true);
});

test('migrateChartCustomization preserves description', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: 'country',
      description: 'Filter by country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.description).toBe('Filter by country');
});

test('migrateChartCustomization handles null dataset', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: null,
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].datasetId).toBe(0);
});

test('migrateChartCustomization handles null column', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 1,
      column: null,
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].column?.name).toBe('');
});

test('migrateChartCustomization handles non-numeric string dataset', () => {
  const legacy = {
    id: 'CUSTOMIZATION-1',
    customization: {
      name: 'Test',
      dataset: 'not-a-number',
      column: 'country',
    },
  };

  const result = migrateChartCustomization(legacy);

  expect(result.targets[0].datasetId).toBe(0);
});

test('migrateChartCustomizationArray migrates mixed array', () => {
  const items = [
    {
      id: 'CUSTOMIZATION-1',
      customization: {
        name: 'Legacy',
        dataset: 1,
        column: 'country',
      },
    },
    {
      id: 'CUSTOMIZATION-2',
      type: ChartCustomizationType.ChartCustomization,
      name: 'Already Migrated',
      filterType: ChartCustomizationPlugins.DynamicGroupBy,
      targets: [{ datasetId: 2, column: { name: 'region' } }],
      scope: { rootPath: [DASHBOARD_ROOT_ID], excluded: [] },
      chartsInScope: [],
      tabsInScope: [],
      cascadeParentIds: [],
      defaultDataMask: { extraFormData: {}, filterState: {} },
      controlValues: {},
    },
  ];

  const result = migrateChartCustomizationArray(items);

  expect(result).toHaveLength(2);
  expect(result[0].type).toBe(ChartCustomizationType.ChartCustomization);
  expect(result[0].name).toBe('Legacy');
  expect(result[1].name).toBe('Already Migrated');
});

test('migrateChartCustomizationArray handles empty array', () => {
  const result = migrateChartCustomizationArray([]);
  expect(result).toEqual([]);
});

test('migrateChartCustomizationArray handles all legacy items', () => {
  const items = [
    {
      id: 'CUSTOMIZATION-1',
      customization: {
        name: 'First',
        dataset: 1,
        column: 'col1',
      },
    },
    {
      id: 'CUSTOMIZATION-2',
      customization: {
        name: 'Second',
        dataset: 2,
        column: 'col2',
      },
    },
  ];

  const result = migrateChartCustomizationArray(items);

  expect(result).toHaveLength(2);
  expect(result[0].type).toBe(ChartCustomizationType.ChartCustomization);
  expect(result[1].type).toBe(ChartCustomizationType.ChartCustomization);
  expect(result[0].name).toBe('First');
  expect(result[1].name).toBe('Second');
});

test('migrateChartCustomizationArray handles all new format items', () => {
  const items = [
    {
      id: 'CUSTOMIZATION-1',
      type: ChartCustomizationType.ChartCustomization,
      name: 'First',
      filterType: ChartCustomizationPlugins.DynamicGroupBy,
      targets: [{ datasetId: 1, column: { name: 'col1' } }],
      scope: { rootPath: [DASHBOARD_ROOT_ID], excluded: [] },
      chartsInScope: [],
      tabsInScope: [],
      cascadeParentIds: [],
      defaultDataMask: { extraFormData: {}, filterState: {} },
      controlValues: {},
    },
    {
      id: 'CUSTOMIZATION-2',
      type: ChartCustomizationType.ChartCustomization,
      name: 'Second',
      filterType: ChartCustomizationPlugins.DynamicGroupBy,
      targets: [{ datasetId: 2, column: { name: 'col2' } }],
      scope: { rootPath: [DASHBOARD_ROOT_ID], excluded: [] },
      chartsInScope: [],
      tabsInScope: [],
      cascadeParentIds: [],
      defaultDataMask: { extraFormData: {}, filterState: {} },
      controlValues: {},
    },
  ];

  const result = migrateChartCustomizationArray(items);

  expect(result).toHaveLength(2);
  expect(result[0].name).toBe('First');
  expect(result[1].name).toBe('Second');
});
