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
import { transformCustomizationForSave } from './customizationTransformer';

test('treats a dynamic title form item with an undefined dataset as form input', () => {
  const formItem = {
    name: 'Dynamic title',
    filterType: ChartCustomizationPlugins.DynamicTitle,
    dataset: undefined,
    column: null,
    controlValues: {
      template: '{{chart_title}} - {{country}}',
      tokenMappings: { country: 'NATIVE_FILTER-country' },
    },
    requiredFirst: {},
    defaultValue: null,
    defaultDataMask: null,
    sortMetric: null,
    description: ' Title ',
    scope: {
      rootPath: ['ROOT_ID'],
      excluded: [],
    },
  };

  const result = transformCustomizationForSave(
    'CHART_CUSTOMIZATION-dynamic-title',
    formItem as unknown as Parameters<typeof transformCustomizationForSave>[1],
  );

  expect(result).toEqual({
    id: 'CHART_CUSTOMIZATION-dynamic-title',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Dynamic title',
    filterType: ChartCustomizationPlugins.DynamicTitle,
    description: 'Title',
    targets: [],
    scope: {
      rootPath: ['ROOT_ID'],
      excluded: [],
    },
    controlValues: {
      template: '{{chart_title}} - {{country}}',
      tokenMappings: { country: 'NATIVE_FILTER-country' },
    },
    defaultDataMask: {},
    removed: false,
  });
});
