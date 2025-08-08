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
  formatSelectOptions,
} from '@superset-ui/chart-controls';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Time Section
    granularity_sqla: {
      type: 'string',
      title: t('Time Column'),
      default: '',
    },
    time_range: {
      type: 'string',
      title: t('Time range'),
      default: 'No filter',
    },
    
    // Query Section
    metrics: {
      type: 'array',
      title: t('Metrics'),
      items: { type: 'object' },
      default: [],
    },
    adhoc_filters: {
      type: 'array',
      title: t('Filters'),
      items: { type: 'object' },
      default: [],
    },
    groupby: {
      type: 'array',
      title: t('Group by'),
      items: { type: 'string' },
      default: [],
    },
    limit: {
      type: 'integer',
      title: t('Series limit'),
      minimum: 0,
      default: 25,
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
    contribution: {
      type: 'boolean',
      title: t('Contribution'),
      default: false,
    },
    row_limit: {
      type: 'integer',
      title: t('Row limit'),
      minimum: 0,
      default: 10000,
    },
    
    // Chart Options Section
    series_height: {
      type: 'string',
      title: t('Series Height'),
      enum: ['10', '25', '40', '50', '75', '100', '150', '200'],
      default: '25',
    },
    horizon_color_scale: {
      type: 'string',
      title: t('Value Domain'),
      enum: ['series', 'overall', 'change'],
      default: 'series',
    },
  },
  required: ['metrics'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Time'), [
    {
      type: 'Control',
      scope: '#/properties/granularity_sqla',
      options: { 
        controlType: 'GranularitySqlaControl',
        description: t('Time related form attributes'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/time_range',
      options: { controlType: 'TimeRangeControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/metrics',
      options: { controlType: 'MetricsControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/adhoc_filters',
      options: { controlType: 'AdhocFiltersControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/groupby',
      options: { controlType: 'GroupByControl' },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/limit',
        options: { controlType: 'LimitControl' },
      },
      {
        type: 'Control',
        scope: '#/properties/timeseries_limit_metric',
        options: { controlType: 'TimeLimitMetricControl' },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/order_desc',
      options: { controlType: 'OrderDescControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/contribution',
      options: {
        controlType: 'CheckboxControl',
        description: t('Compute the contribution to the total'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/row_limit',
      options: { controlType: 'RowLimitControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Chart Options'), [
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/series_height',
        options: {
          controlType: 'SelectControl',
          renderTrigger: true,
          freeForm: true,
          choices: formatSelectOptions([
            '10',
            '25',
            '40',
            '50',
            '75',
            '100',
            '150',
            '200',
          ]),
          description: t('Pixel height of each series'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/horizon_color_scale',
        options: {
          controlType: 'SelectControl',
          renderTrigger: true,
          choices: [
            ['series', t('series')],
            ['overall', t('overall')],
            ['change', t('change')],
          ],
          description: t(
            'series: Treat each series independently; overall: All series use the same scale; change: Show changes compared to the first data point in each series',
          ),
        },
      },
    ]),
  ], true),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
};

export default config;