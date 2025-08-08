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
import { ensureIsArray, t, validateNonEmpty } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    groupby: {
      type: 'array',
      title: t('Source'),
      items: { type: 'string' },
      maxItems: 1,
      default: [],
    },
    columns: {
      type: 'array',
      title: t('Target'),
      items: { type: 'string' },
      maxItems: 1,
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
      default: 10000,
    },
    sort_by_metric: {
      type: 'boolean',
      title: t('Sort by metric'),
      default: true,
    },
    
    // Chart Options Section
    y_axis_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    color_scheme: {
      type: 'string',
      title: t('Color scheme'),
      default: 'supersetColors',
    },
  },
  required: ['groupby', 'columns', 'metric'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/groupby',
      options: { 
        controlType: 'GroupByControl',
        multi: false,
        validators: [validateNonEmpty],
        description: t('Choose a source'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/columns',
      options: { 
        controlType: 'ColumnsControl',
        multi: false,
        validators: [validateNonEmpty],
        description: t('Choose a target'),
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
  
  createCollapsibleGroup(t('Chart Options'), [
    {
      type: 'Control',
      scope: '#/properties/y_axis_format',
      options: { 
        controlType: 'YAxisFormatControl',
        description: t('Choose a number format'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/color_scheme',
      options: { controlType: 'ColorSchemeControl' },
    },
  ], true, 'customize'),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
      description: t('Choose a number format'),
    },
    groupby: {
      label: t('Source'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a source'),
    },
    columns: {
      label: t('Target'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a target'),
    },
  },
  formDataOverrides: (formData: any) => {
    const groupby = getStandardizedControls()
      .popAllColumns()
      .filter(col => !ensureIsArray(formData.columns).includes(col));
    return {
      ...formData,
      groupby,
      metric: getStandardizedControls().shiftMetric(),
    };
  },
};

export default config;