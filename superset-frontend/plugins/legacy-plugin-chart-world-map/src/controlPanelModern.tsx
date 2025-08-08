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
  createCollapsibleGroup,
  formatSelectOptions,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { ColorBy } from './utils';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    entity: {
      type: 'string',
      title: t('Country Column'),
      default: '',
    },
    country_fieldtype: {
      type: 'string',
      title: t('Country Field Type'),
      enum: ['name', 'cioc', 'cca2', 'cca3'],
      default: 'cca2',
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
      default: 10000,
    },
    sort_by_metric: {
      type: 'boolean',
      title: t('Sort by metric'),
      default: true,
    },
    
    // Options Section
    show_bubbles: {
      type: 'boolean',
      title: t('Show Bubbles'),
      default: false,
    },
    secondary_metric: {
      type: 'string',
      title: t('Bubble Size'),
      default: '',
    },
    max_bubble_size: {
      type: 'string',
      title: t('Max Bubble Size'),
      enum: ['5', '10', '15', '25', '50', '75', '100'],
      default: '25',
    },
    color_picker: {
      type: 'string',
      title: t('Bubble Color'),
      default: '#1f77b4',
    },
    color_by: {
      type: 'string',
      title: t('Color by'),
      enum: [ColorBy.Metric, ColorBy.Country],
      default: ColorBy.Metric,
    },
    linear_color_scheme: {
      type: 'string',
      title: t('Country Color Scheme'),
      default: 'blue_white_yellow',
    },
    color_scheme: {
      type: 'string',
      title: t('Country Color Scheme'),
      default: 'supersetColors',
    },
    
    // Chart Options Section
    y_axis_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    currency_format: {
      type: 'object',
      title: t('Currency format'),
    },
  },
  required: ['entity', 'metric'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/entity',
      options: { controlType: 'EntityControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/country_fieldtype',
      options: {
        controlType: 'SelectControl',
        choices: [
          ['name', t('Full name')],
          ['cioc', t('code International Olympic Committee (cioc)')],
          ['cca2', t('code ISO 3166-1 alpha-2 (cca2)')],
          ['cca3', t('code ISO 3166-1 alpha-3 (cca3)')],
        ],
        description: t(
          'The country code standard that Superset should expect to find in the [country] column',
        ),
      },
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
    {
      type: 'Control',
      scope: '#/properties/show_bubbles',
      options: {
        controlType: 'CheckboxControl',
        renderTrigger: true,
        description: t('Whether to display bubbles on top of countries'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/secondary_metric',
      options: { controlType: 'SecondaryMetricControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/max_bubble_size',
      options: {
        controlType: 'SelectControl',
        freeForm: true,
        choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/color_picker',
      options: { controlType: 'ColorPickerControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/color_by',
      options: {
        controlType: 'RadioButtonControl',
        options: [
          [ColorBy.Metric, t('Metric')],
          [ColorBy.Country, t('Country')],
        ],
        description: t(
          'Choose whether a country should be shaded by the metric, or assigned a color based on a categorical color palette',
        ),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/linear_color_scheme',
      options: { controlType: 'LinearColorSchemeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/color_scheme',
      options: { controlType: 'ColorSchemeControl' },
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
      scope: '#/properties/currency_format',
      options: { controlType: 'CurrencyFormatControl' },
    },
  ], true),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    entity: {
      label: t('Country Column'),
      description: t('3 letter code of the country'),
    },
    secondary_metric: {
      label: t('Bubble Size'),
      description: t('Metric that defines the size of the bubble'),
    },
    color_picker: {
      label: t('Bubble Color'),
    },
    linear_color_scheme: {
      label: t('Country Color Scheme'),
      visibility: ({ controls }: any) =>
        Boolean(controls?.color_by.value === ColorBy.Metric),
    },
    color_scheme: {
      label: t('Country Color Scheme'),
      visibility: ({ controls }: any) =>
        Boolean(controls?.color_by.value === ColorBy.Country),
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;