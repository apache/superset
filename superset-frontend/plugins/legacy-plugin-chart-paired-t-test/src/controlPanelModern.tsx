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
} from '@superset-ui/chart-controls';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
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
    
    // Parameters Section
    significance_level: {
      type: 'number',
      title: t('Significance Level'),
      minimum: 0,
      maximum: 1,
      default: 0.05,
    },
    pvalue_precision: {
      type: 'integer',
      title: t('p-value precision'),
      minimum: 0,
      default: 6,
    },
    liftvalue_precision: {
      type: 'integer',
      title: t('Lift percent precision'),
      minimum: 0,
      default: 4,
    },
  },
  required: ['metrics', 'groupby'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
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
      options: {
        controlType: 'GroupByControl',
        validators: [validateNonEmpty],
      },
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
  
  createCollapsibleGroup(t('Parameters'), [
    {
      type: 'Control',
      scope: '#/properties/significance_level',
      options: {
        controlType: 'TextControl',
        description: t('Threshold alpha level for determining significance'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/pvalue_precision',
      options: {
        controlType: 'TextControl',
        description: t('Number of decimal places with which to display p-values'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/liftvalue_precision',
      options: {
        controlType: 'TextControl',
        description: t('Number of decimal places with which to display lift values'),
      },
    },
  ], false),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
};

export default config;