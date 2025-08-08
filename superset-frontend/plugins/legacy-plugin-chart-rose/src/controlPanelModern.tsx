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
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
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
    color_scheme: {
      type: 'string',
      title: t('Color scheme'),
      default: 'supersetColors',
    },
    number_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    date_time_format: {
      type: 'string',
      title: t('Date Time Format'),
      default: 'smart_date',
    },
    rich_tooltip: {
      type: 'boolean',
      title: t('Rich Tooltip'),
      default: true,
    },
    rose_area_proportion: {
      type: 'boolean',
      title: t('Use Area Proportions'),
      default: false,
    },
    
    // Advanced Analytics Section
    rolling_type: {
      type: 'string',
      title: t('Rolling Function'),
      enum: ['None', 'mean', 'sum', 'std', 'cumsum'],
      default: 'None',
    },
    rolling_periods: {
      type: 'integer',
      title: t('Periods'),
      minimum: 1,
    },
    min_periods: {
      type: 'integer',
      title: t('Min Periods'),
      minimum: 1,
    },
    time_compare: {
      type: 'array',
      title: t('Time Shift'),
      items: { type: 'string' },
      default: [],
    },
    comparison_type: {
      type: 'string',
      title: t('Calculation type'),
      enum: ['values', 'absolute', 'percentage', 'ratio'],
      default: 'values',
    },
    resample_rule: {
      type: 'string',
      title: t('Rule'),
      enum: ['1T', '1H', '1D', '7D', '1M', '1AS'],
    },
    resample_method: {
      type: 'string',
      title: t('Method'),
      enum: ['asfreq', 'bfill', 'ffill', 'median', 'mean', 'sum'],
    },
  },
  required: ['metrics'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  // Legacy Time Section
  createCollapsibleGroup(t('Time'), [
    {
      type: 'Control',
      scope: '#/properties/granularity_sqla',
      options: { controlType: 'GranularitySqlaControl' },
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
    {
      type: 'Control',
      scope: '#/properties/color_scheme',
      options: { controlType: 'ColorSchemeControl' },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/number_format',
        options: {
          controlType: 'SelectControl',
          freeForm: true,
          renderTrigger: true,
          choices: D3_FORMAT_OPTIONS,
          description: D3_FORMAT_DOCS,
        },
      },
      {
        type: 'Control',
        scope: '#/properties/date_time_format',
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
        scope: '#/properties/rich_tooltip',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t('The rich tooltip shows a list of all series for that point in time'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/rose_area_proportion',
        options: {
          controlType: 'CheckboxControl',
          renderTrigger: true,
          description: t(
            'Check if the Rose Chart should use segment area instead of segment radius for proportioning',
          ),
        },
      },
    ]),
  ], true),
  
  createCollapsibleGroup(t('Advanced Analytics'), [
    // Rolling Window section
    {
      type: 'Control',
      scope: '#/properties/rolling_type',
      options: {
        controlType: 'SelectControl',
        choices: [
          ['None', t('None')],
          ['mean', t('mean')],
          ['sum', t('sum')],
          ['std', t('std')],
          ['cumsum', t('cumsum')],
        ],
        description: t(
          'Defines a rolling window function to apply, works along with the [Periods] text box',
        ),
      },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/rolling_periods',
        options: {
          controlType: 'TextControl',
          isInt: true,
          description: t(
            'Defines the size of the rolling window function, relative to the time granularity selected',
          ),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/min_periods',
        options: {
          controlType: 'TextControl',
          isInt: true,
          description: t(
            'The minimum number of rolling periods required to show a value. For instance if you do a cumulative sum on 7 days you may want your "Min Period" to be 7, so that all data points shown are the total of 7 periods. This will hide the "ramp up" taking place over the first 7 periods',
          ),
        },
      },
    ]),
    // Time Comparison section
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/time_compare',
        options: {
          controlType: 'SelectControl',
          multi: true,
          freeForm: true,
          choices: [
            ['1 day', t('1 day')],
            ['1 week', t('1 week')],
            ['28 days', t('28 days')],
            ['30 days', t('30 days')],
            ['52 weeks', t('52 weeks')],
            ['1 year', t('1 year')],
            ['104 weeks', t('104 weeks')],
            ['2 years', t('2 years')],
            ['156 weeks', t('156 weeks')],
            ['3 years', t('3 years')],
          ],
          description: t(
            'Overlay one or more timeseries from a relative time period. Expects relative time deltas in natural language (example:  24 hours, 7 days, 52 weeks, 365 days). Free text is supported.',
          ),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/comparison_type',
        options: {
          controlType: 'SelectControl',
          choices: [
            ['values', t('Actual Values')],
            ['absolute', t('Difference')],
            ['percentage', t('Percentage change')],
            ['ratio', t('Ratio')],
          ],
          description: t(
            'How to display time shifts: as individual lines; as the difference between the main time series and each time shift; as the percentage change; or as the ratio between series and time shifts.',
          ),
        },
      },
    ]),
    // Resample section
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/resample_rule',
        options: {
          controlType: 'SelectControl',
          freeForm: true,
          choices: [
            ['1T', t('1T')],
            ['1H', t('1H')],
            ['1D', t('1D')],
            ['7D', t('7D')],
            ['1M', t('1M')],
            ['1AS', t('1AS')],
          ],
          description: t('Pandas resample rule'),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/resample_method',
        options: {
          controlType: 'SelectControl',
          freeForm: true,
          choices: [
            ['asfreq', t('asfreq')],
            ['bfill', t('bfill')],
            ['ffill', t('ffill')],
            ['median', t('median')],
            ['mean', t('mean')],
            ['sum', t('sum')],
          ],
          description: t('Pandas resample method'),
        },
      },
    ]),
  ], false, 'data'),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  formDataOverrides: (formData: any) => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};

export default config;