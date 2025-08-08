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
  createCollapsibleGroup,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { countryOptions } from './countries';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    select_country: {
      type: 'string',
      title: t('Country'),
      enum: countryOptions.map(option => option[0]),
      default: null,
    },
    entity: {
      type: 'string',
      title: t('ISO 3166-2 Codes'),
      default: '',
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
    
    // Chart Options Section
    number_format: {
      type: 'string',
      title: t('Number format'),
      default: 'SMART_NUMBER',
    },
    linear_color_scheme: {
      type: 'string',
      title: t('Linear color scheme'),
      default: 'blue_white_yellow',
    },
  },
  required: ['select_country', 'entity', 'metric'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/select_country',
      options: {
        controlType: 'SelectControl',
        choices: countryOptions,
        description: t('Which country to plot the map for?'),
        validators: [validateNonEmpty],
      },
    },
    {
      type: 'Control',
      scope: '#/properties/entity',
      options: { controlType: 'EntityControl' },
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
  ], true),
  
  createCollapsibleGroup(t('Chart Options'), [
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
      scope: '#/properties/linear_color_scheme',
      options: { controlType: 'LinearColorSchemeControl' },
    },
  ], true, 'customize'),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    entity: {
      label: t('ISO 3166-2 Codes'),
      description: t(
        'Column containing ISO 3166-2 codes of region/province/department in your table.',
      ),
    },
    metric: {
      label: t('Metric'),
      description: t('Metric to display bottom title'),
    },
    linear_color_scheme: {
      renderTrigger: false,
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;