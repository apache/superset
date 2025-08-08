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
import { t } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
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
    metrics: {
      type: 'array',
      title: t('Metrics'),
      items: { type: 'object' },
      default: [],
    },
    secondary_metric: {
      type: 'string',
      title: t('Color Metric'),
      default: '',
    },
    adhoc_filters: {
      type: 'array',
      title: t('Filters'),
      items: { type: 'object' },
      default: [],
    },
    limit: {
      type: 'integer',
      title: t('Series limit'),
      minimum: 0,
      default: 25,
    },
    row_limit: {
      type: 'integer',
      title: t('Row limit'),
      minimum: 0,
      default: 10000,
    },
    timeseries_limit_metric: {
      type: 'string',
      title: t('Sort by'),
      default: '',
    },
    order_desc: {
      type: 'boolean',
      title: t('Sort descending'),
      default: true,
    },
    
    // Options Section
    show_datatable: {
      type: 'boolean',
      title: t('Data Table'),
      default: false,
    },
    include_series: {
      type: 'boolean',
      title: t('Include Series'),
      default: false,
    },
    linear_color_scheme: {
      type: 'string',
      title: t('Linear color scheme'),
      default: 'blue_white_yellow',
    },
  },
  required: ['series', 'metrics'],
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
      scope: '#/properties/metrics',
      options: { controlType: 'MetricsControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/secondary_metric',
      options: { controlType: 'SecondaryMetricControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/adhoc_filters',
      options: { controlType: 'AdhocFiltersControl' },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/limit',
        options: { controlType: 'LimitControl' },
      },
      {
        type: 'Control',
        scope: '#/properties/row_limit',
        options: { controlType: 'RowLimitControl' },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/timeseries_limit_metric',
      options: { controlType: 'TimeLimitMetricControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/order_desc',
      options: { controlType: 'OrderDescControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Options'), [
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/show_datatable',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('Whether to display the interactive data table'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/include_series',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('Include series name as an axis'),
        },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/linear_color_scheme',
      options: { controlType: 'LinearColorSchemeControl' },
    },
  ], true),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
};

export default config;