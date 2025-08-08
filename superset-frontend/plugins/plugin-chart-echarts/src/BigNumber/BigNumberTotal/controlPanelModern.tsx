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
import { GenericDataType, SMART_DATE_ID, t } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createCollapsibleGroup,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

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
    granularity: {
      type: 'string',
      title: t('Time Column'),
      default: '',
    },
    
    // Chart Options Section
    header_font_size: {
      type: 'string',
      title: t('Header Font Size'),
      default: '0.4',
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
    y_axis_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    currency_format: {
      type: 'object',
      title: t('Currency format'),
    },
    time_format: {
      type: 'string',
      title: t('Date format'),
      default: SMART_DATE_ID,
    },
    force_timestamp_formatting: {
      type: 'boolean',
      title: t('Force date format'),
      default: false,
    },
    conditional_formatting: {
      type: 'array',
      title: t('Conditional Formatting'),
      items: { type: 'object' },
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
      scope: '#/properties/granularity',
      options: {
        controlType: 'GranularityControl',
        description: t('Select the time column for temporal filtering'),
        clearable: true,
        temporalColumnsOnly: true,
      },
    },
  ], true),
  
  createCollapsibleGroup(t('Chart Options'), [
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
      scope: '#/properties/y_axis_format',
      options: { controlType: 'YAxisFormatControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/currency_format',
      options: { controlType: 'CurrencyFormatControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/time_format',
      options: {
        controlType: 'SelectControl',
        freeForm: true,
        renderTrigger: true,
        choices: D3_TIME_FORMAT_OPTIONS,
        description: D3_FORMAT_DOCS,
      },
    },
    {
      type: 'Control',
      scope: '#/properties/force_timestamp_formatting',
      options: {
        controlType: 'CheckboxControl',
        renderTrigger: true,
        description: t('Use date formatting even when metric value is not a timestamp'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/conditional_formatting',
      options: {
        controlType: 'ConditionalFormattingControl',
        renderTrigger: true,
        description: t('Apply conditional color formatting to metric'),
        shouldMapStateToProps() {
          return true;
        },
        mapStateToProps(explore: any, _: any, chart: any) {
          const verboseMap = explore?.datasource?.hasOwnProperty('verbose_map')
            ? (explore?.datasource as Dataset)?.verbose_map
            : (explore?.datasource?.columns ?? {});
          const { colnames, coltypes } = chart?.queriesResponse?.[0] ?? {};
          const numericColumns =
            Array.isArray(colnames) && Array.isArray(coltypes)
              ? colnames
                  .filter(
                    (_: string, index: number) =>
                      coltypes[index] === GenericDataType.Numeric,
                  )
                  .map((colname: string | number) => ({
                    value: colname,
                    label:
                      (Array.isArray(verboseMap)
                        ? verboseMap[colname as number]
                        : verboseMap[colname as string]) ?? colname,
                  }))
              : [];
          return {
            columnOptions: numericColumns,
            verboseMap,
          };
        },
      },
    },
  ], true),
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