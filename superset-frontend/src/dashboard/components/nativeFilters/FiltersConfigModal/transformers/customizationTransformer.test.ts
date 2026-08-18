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
import { ChartCustomization, ChartCustomizationType } from '@superset-ui/core';
import { ChartCustomizationsFormItem } from '../types';
import { transformCustomizationForSave } from './customizationTransformer';

const baseFormItem = {
  type: ChartCustomizationType.ChartCustomization,
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues: {},
  requiredFirst: {},
  defaultValue: null,
  defaultDataMask: { filterState: {}, extraFormData: {} },
  sortMetric: null,
  description: '',
  // form-only field that must never leak into the saved customization
  defaultValueQueriesData: null,
} as unknown as ChartCustomizationsFormItem;

test('serializes a dataset-less customization into a full ChartCustomization', () => {
  // Customization plugins declaring ``datasourceCount: 0`` render no dataset
  // control, so their form item carries neither ``dataset`` nor ``targets``.
  const formItem = {
    ...baseFormItem,
    name: 'Layer visibility',
    filterType: 'customization_deckgl_layer_visibility',
  } as unknown as ChartCustomizationsFormItem;

  const result = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-abc',
    formItem,
  ) as ChartCustomization;

  expect(result.targets).toEqual([{}]);
  expect(result.defaultDataMask).toBeDefined();
  expect(result.removed).toBe(false);
  expect(result).not.toHaveProperty('defaultValueQueriesData');
});

test('serializes a dataset-backed customization into a full ChartCustomization', () => {
  const formItem = {
    ...baseFormItem,
    name: 'Group by',
    filterType: 'customization_dynamic_group_by',
    dataset: { value: 42, label: 'sales' },
    column: 'region',
  } as unknown as ChartCustomizationsFormItem;

  const result = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-def',
    formItem,
  ) as ChartCustomization;

  expect(result.targets).toEqual([
    { datasetId: 42, column: { name: 'region' } },
  ]);
  expect(result).not.toHaveProperty('defaultValueQueriesData');
});

test('passes an already-saved ChartCustomization through untouched', () => {
  const saved: ChartCustomization = {
    id: 'CHART_CUSTOMIZATION-ghi',
    name: 'Group by',
    filterType: 'customization_dynamic_group_by',
    type: ChartCustomizationType.ChartCustomization,
    targets: [{ datasetId: 42, column: { name: 'region' } }],
    defaultDataMask: { filterState: {}, extraFormData: {} },
    controlValues: {},
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    description: '  needs trim  ',
    chartsInScope: [1, 2],
    tabsInScope: ['TAB-1'],
  };

  const result = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-ghi',
    saved,
  ) as ChartCustomization;

  expect(result.targets).toEqual([
    { datasetId: 42, column: { name: 'region' } },
  ]);
  expect(result.chartsInScope).toEqual([1, 2]);
  expect(result.tabsInScope).toEqual(['TAB-1']);
  expect(result.description).toBe('needs trim');
});
