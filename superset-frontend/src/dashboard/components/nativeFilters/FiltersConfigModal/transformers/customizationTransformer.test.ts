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
import type { ChartCustomizationsFormItem } from '../types';
import { transformCustomizationForSave } from './customizationTransformer';

test('transformCustomizationForSave keeps a canonical target column while preserving multi-select groupby values', () => {
  const formInputs: ChartCustomizationsFormItem = {
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    name: 'Dynamic Group By',
    filterType: 'chart_customization_dynamic_groupby',
    dataset: { value: 1, label: 'orders' },
    column: ['status', 'region'],
    controlValues: {},
    requiredFirst: {},
    defaultValue: null,
    defaultDataMask: {},
    sortMetric: null,
    type: ChartCustomizationType.ChartCustomization,
    description: '',
  };

  const result = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-1',
    formInputs,
  );

  expect(result).toMatchObject({
    id: 'CHART_CUSTOMIZATION-1',
    type: ChartCustomizationType.ChartCustomization,
    targets: [{ datasetId: 1, column: { name: 'status' } }],
    controlValues: { groupby: ['status', 'region'] },
  });
});
