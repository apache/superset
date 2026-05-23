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
import { getInitialDataMask } from 'src/dataMask/reducer';
import type { ChartCustomizationsFormItem } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { transformCustomizationForSave } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/transformers';

const createTimeGrainCustomizationInput = (
  timeGrains?: string[],
): Omit<ChartCustomizationsFormItem, 'type'> => ({
  scope: {
    rootPath: ['ROOT_ID'],
    excluded: [],
  },
  name: 'Time Grain Display Control',
  filterType: 'chart_customization_timegrain',
  dataset: {
    value: 10,
    label: 'main.dataset',
  },
  column: 'dttm',
  controlValues: {},
  requiredFirst: {},
  defaultValue: null,
  defaultDataMask: getInitialDataMask(),
  sortMetric: null,
  time_grains: timeGrains,
  description: '',
});

test('transformCustomizationForSave persists time_grains when a subset is selected', () => {
  const transformed = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-subset',
    createTimeGrainCustomizationInput([
      'PT1H',
      'P1D',
      'P1W',
    ]) as ChartCustomizationsFormItem,
  );

  expect(transformed).toBeDefined();
  expect(transformed?.type).toBe(ChartCustomizationType.ChartCustomization);
  expect(transformed && 'time_grains' in transformed).toBe(true);
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toEqual(['PT1H', 'P1D', 'P1W']);
});

test('transformCustomizationForSave omits time_grains from API payload when all are selected', () => {
  const transformed = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-all',
    createTimeGrainCustomizationInput(undefined) as ChartCustomizationsFormItem,
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  // API boundary: undefined keys are omitted from JSON payloads.
  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});

test('transformCustomizationForSave remains backward compatible when time_grains is missing', () => {
  const formInput = createTimeGrainCustomizationInput();
  delete (formInput as Partial<ChartCustomizationsFormItem>).time_grains;

  const transformed = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-legacy',
    formInput as ChartCustomizationsFormItem,
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});

test('transformCustomizationForSave omits time_grains when an empty array is provided', () => {
  const transformed = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-empty-array',
    createTimeGrainCustomizationInput([]) as ChartCustomizationsFormItem,
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  // API boundary: empty allowlist should behave like unrestricted and be omitted.
  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});

test('transformCustomizationForSave preserves saved time_grains when reloading an existing customization', () => {
  // Simulates the edit round-trip: a previously saved ChartCustomization is
  // passed back through the transformer. The allowlist must survive intact so
  // the edit modal can restore it.
  const savedCustomization: ChartCustomization = {
    id: 'CHART_CUSTOMIZATION-existing',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Time Grain Display Control',
    filterType: 'chart_customization_timegrain',
    description: '',
    targets: [{ datasetId: 10, column: { name: 'dttm' } }],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    controlValues: {},
    defaultDataMask: getInitialDataMask(),
    removed: false,
    time_grains: ['PT1H', 'P1D'],
  };

  const transformed = transformCustomizationForSave(
    savedCustomization.id,
    savedCustomization,
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toEqual(['PT1H', 'P1D']);
});
