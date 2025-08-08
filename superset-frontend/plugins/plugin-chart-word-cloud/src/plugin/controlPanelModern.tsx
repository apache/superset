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
import { t, validateNonEmpty } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  createControl,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    series: {
      type: 'array',
      title: t('Series'),
      items: { type: 'string' },
      default: [],
    },
    metric: {
      type: 'string',
      title: t('Metric'),
      default: '',
    },
    adhoc_filters: {
      type: 'array',
      title: t('Filters'),
      items: { type: 'object' },
      default: [],
    },
    row_limit: {
      type: 'integer',
      title: t('Row limit'),
      minimum: 0,
      default: 100,
    },
    sort_by_metric: {
      type: 'boolean',
      title: t('Sort by metric'),
      default: true,
    },
    
    // Options Section
    size_from: {
      type: 'integer',
      title: t('Minimum Font Size'),
      minimum: 1,
      default: 10,
    },
    size_to: {
      type: 'integer',
      title: t('Maximum Font Size'),
      minimum: 1,
      default: 70,
    },
    rotation: {
      type: 'string',
      title: t('Word Rotation'),
      enum: ['random', 'flat', 'square'],
      default: 'square',
    },
    color_scheme: {
      type: 'string',
      title: t('Color scheme'),
      default: 'supersetColors',
    },
  },
  required: ['series', 'metric'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/series',
      options: { controlType: 'SeriesControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/metric',
      options: { controlType: 'MetricControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/adhoc_filters',
      options: { controlType: 'AdhocFiltersControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/row_limit',
      options: { controlType: 'RowLimitControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/sort_by_metric',
      options: { controlType: 'SortByMetricControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Options'), [
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/size_from',
        options: { 
          controlType: 'TextControl',
          isInt: true,
          renderTrigger: true,
          description: t('Font size for the smallest value in the list'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/size_to',
        options: { 
          controlType: 'TextControl',
          isInt: true,
          renderTrigger: true,
          description: t('Font size for the biggest value in the list'),
        },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/rotation',
      options: { 
        controlType: 'SelectControl',
        choices: [
          ['random', t('random')],
          ['flat', t('flat')],
          ['square', t('square')],
        ],
        renderTrigger: true,
        clearable: false,
        description: t('Rotation to apply to words in the cloud'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/color_scheme',
      options: { controlType: 'ColorSchemeControl' },
    },
  ], true),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    series: {
      validators: [validateNonEmpty],
      clearable: false,
    },
    row_limit: {
      default: 100,
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    series: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;