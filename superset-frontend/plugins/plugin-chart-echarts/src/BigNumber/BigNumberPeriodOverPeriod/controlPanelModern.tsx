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
import { t, GenericDataType } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createCollapsibleGroup,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { noop } from 'lodash';
import { ColorSchemeEnum } from './types';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
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
      default: 10000,
    },
    
    // Chart Options Section
    y_axis_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    percentDifferenceFormat: {
      type: 'string',
      title: t('Percent Difference format'),
      default: 'SMART_NUMBER',
    },
    currency_format: {
      type: 'object',
      title: t('Currency format'),
    },
    header_font_size: {
      type: 'string',
      title: t('Header Font Size'),
      default: '0.2',
    },
    subheader: {
      type: 'string',
      title: t('Subheader'),
      default: '',
    },
    subheader_font_size: {
      type: 'string',
      title: t('Subheader Font Size'),
      default: '0.15',
    },
    show_metric_name: {
      type: 'boolean',
      title: t('Show Metric Names'),
      default: true,
    },
    metric_name_font_size: {
      type: 'string',
      title: t('Metric name font size'),
      default: '0.15',
    },
    comparison_font_size: {
      type: 'string',
      title: t('Comparison font size'),
      default: '0.125',
    },
    comparison_color_enabled: {
      type: 'boolean',
      title: t('Add color for positive/negative change'),
      default: false,
    },
    comparison_color_scheme: {
      type: 'string',
      title: t('color scheme for comparison'),
      enum: [ColorSchemeEnum.Green, ColorSchemeEnum.Red],
      default: ColorSchemeEnum.Green,
    },
    column_config: {
      type: 'object',
      title: t('Customize columns'),
    },
    
    // Time Comparison Section
    time_compare: {
      type: 'array',
      title: t('Time Shift'),
      items: { type: 'string' },
      default: [],
    },
  },
  required: ['metric'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
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
  ], true),
  
  createCollapsibleGroup(t('Chart Options'), [
    {
      type: 'Control',
      scope: '#/properties/y_axis_format',
      options: { controlType: 'YAxisFormatControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/percentDifferenceFormat',
      options: { controlType: 'YAxisFormatControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/currency_format',
      options: { controlType: 'CurrencyFormatControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/header_font_size',
      options: { controlType: 'HeaderFontSizeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/subheader',
      options: { controlType: 'SubtitleControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/subheader_font_size',
      options: { controlType: 'SubtitleFontSizeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/show_metric_name',
      options: { controlType: 'ShowMetricNameControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/metric_name_font_size',
      options: { controlType: 'MetricNameFontSizeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/comparison_font_size',
      options: { controlType: 'SubheaderFontSizeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/comparison_color_enabled',
      options: {
        controlType: 'CheckboxControl',
        renderTrigger: true,
        description: t('Add color for positive/negative change'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/comparison_color_scheme',
      options: {
        controlType: 'SelectControl',
        renderTrigger: true,
        choices: [
          [ColorSchemeEnum.Green, 'Green for increase, red for decrease'],
          [ColorSchemeEnum.Red, 'Red for increase, green for decrease'],
        ],
        visibility: ({ controls }: any) =>
          controls?.comparison_color_enabled?.value === true,
        description: t(
          'Adds color to the chart symbols based on the positive or negative change from the comparison value.',
        ),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/column_config',
      options: {
        controlType: 'ColumnConfigControl',
        description: t('Further customize how to display each column'),
        width: 400,
        height: 320,
        renderTrigger: true,
        configFormLayout: {
          [GenericDataType.Numeric]: [
            {
              tab: t('General'),
              children: [['customColumnName'], ['displayTypeIcon'], ['visible']],
            },
          ],
        },
        shouldMapStateToProps() {
          return true;
        },
        mapStateToProps(explore: any, _: any, chart: any) {
          noop(explore, _, chart);
          return {
            columnsPropsObject: {
              colnames: ['Previous value', 'Delta', 'Percent change'],
              coltypes: [
                GenericDataType.Numeric,
                GenericDataType.Numeric,
                GenericDataType.Numeric,
              ],
            },
          };
        },
      },
    },
  ], true),
  
  createCollapsibleGroup(t('Time Comparison'), [
    {
      type: 'Control',
      scope: '#/properties/time_compare',
      options: {
        controlType: 'SelectControl',
        multi: false,
        showCalculationType: false,
        showFullChoices: false,
      },
    },
  ]),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;