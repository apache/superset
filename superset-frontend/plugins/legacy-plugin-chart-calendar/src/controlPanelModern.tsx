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
import { t, legacyValidateInteger } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
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
    domain_granularity: {
      type: 'string',
      title: t('Domain'),
      enum: ['hour', 'day', 'week', 'month', 'year'],
      default: 'month',
    },
    subdomain_granularity: {
      type: 'string',
      title: t('Subdomain'),
      enum: ['min', 'hour', 'day', 'week', 'month'],
      default: 'day',
    },
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
    
    // Chart Options Section
    linear_color_scheme: {
      type: 'string',
      title: t('Linear color scheme'),
      default: 'blue_white_yellow',
    },
    cell_size: {
      type: 'integer',
      title: t('Cell Size'),
      minimum: 1,
      default: 10,
    },
    cell_padding: {
      type: 'integer',
      title: t('Cell Padding'),
      minimum: 0,
      default: 2,
    },
    cell_radius: {
      type: 'integer',
      title: t('Cell Radius'),
      minimum: 0,
      default: 0,
    },
    steps: {
      type: 'integer',
      title: t('Color Steps'),
      minimum: 1,
      default: 10,
    },
    y_axis_format: {
      type: 'string',
      title: t('Number Format'),
      default: 'SMART_NUMBER',
    },
    x_axis_time_format: {
      type: 'string',
      title: t('Time Format'),
      default: 'smart_date',
    },
    show_legend: {
      type: 'boolean',
      title: t('Legend'),
      default: true,
    },
    show_values: {
      type: 'boolean',
      title: t('Show Values'),
      default: false,
    },
    show_metric_name: {
      type: 'boolean',
      title: t('Show Metric Names'),
      default: true,
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
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/domain_granularity',
        options: {
          controlType: 'SelectControl',
          choices: [
            ['hour', t('hour')],
            ['day', t('day')],
            ['week', t('week')],
            ['month', t('month')],
            ['year', t('year')],
          ],
          description: t('The time unit used for the grouping of blocks'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/subdomain_granularity',
        options: {
          controlType: 'SelectControl',
          choices: [
            ['min', t('min')],
            ['hour', t('hour')],
            ['day', t('day')],
            ['week', t('week')],
            ['month', t('month')],
          ],
          description: t(
            'The time unit for each block. Should be a smaller unit than ' +
              'domain_granularity. Should be larger or equal to Time Grain',
          ),
        },
      },
    ]),
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
  ], true),
  
  createCollapsibleGroup(t('Chart Options'), [
    {
      type: 'Control',
      scope: '#/properties/linear_color_scheme',
      options: { controlType: 'LinearColorSchemeControl' },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/cell_size',
        options: {
          controlType: 'TextControl',
          isInt: true,
          validators: [legacyValidateInteger],
          renderTrigger: true,
          description: t('The size of the square cell, in pixels'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/cell_padding',
        options: {
          controlType: 'TextControl',
          isInt: true,
          validators: [legacyValidateInteger],
          renderTrigger: true,
          description: t('The distance between cells, in pixels'),
        },
      },
    ]),
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/cell_radius',
        options: {
          controlType: 'TextControl',
          isInt: true,
          validators: [legacyValidateInteger],
          renderTrigger: true,
          description: t('The pixel radius'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/steps',
        options: {
          controlType: 'TextControl',
          isInt: true,
          validators: [legacyValidateInteger],
          renderTrigger: true,
          description: t('The number color "steps"'),
        },
      },
    ]),
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/y_axis_format',
        options: { controlType: 'YAxisFormatControl' },
      },
      {
        type: 'Control',
        scope: '#/properties/x_axis_time_format',
        options: {
          controlType: 'SelectControl',
          freeForm: true,
          renderTrigger: true,
          choices: D3_TIME_FORMAT_OPTIONS,
          description: D3_FORMAT_DOCS,
        },
      },
    ]),
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/show_legend',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('Whether to display the legend (toggles)'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/show_values',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('Whether to display the numerical values within the cells'),
        },
      },
    ]),
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/show_metric_name',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('Whether to display the metric name as a title'),
        },
      },
    ]),
  ], true, 'customize'),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    y_axis_format: {
      label: t('Number Format'),
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};

export default config;