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
import { t, validateNonEmpty, legacyValidateInteger } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  formatSelectOptions,
} from '@superset-ui/chart-controls';
import timeGrainSqlaAnimationOverrides, {
  columnChoices,
  PRIMARY_COLOR,
} from '../../utilities/controls';
import {
  COLOR_SCHEME_TYPES,
  isColorSchemeTypeVisible,
} from '../../utilities/utils';

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    start_spatial: {
      type: 'object',
      title: t('Start Longitude & Latitude'),
    },
    end_spatial: {
      type: 'object',
      title: t('End Longitude & Latitude'),
    },
    row_limit: {
      type: 'integer',
      title: t('Row limit'),
      minimum: 0,
      default: 10000,
    },
    filter_nulls: {
      type: 'boolean',
      title: t('Filter Nulls'),
      default: true,
    },
    adhoc_filters: {
      type: 'array',
      title: t('Filters'),
      items: { type: 'object' },
      default: [],
    },
    
    // Map Section
    mapbox_style: {
      type: 'string',
      title: t('Map Style'),
      default: 'mapbox://styles/mapbox/light-v9',
    },
    autozoom: {
      type: 'boolean',
      title: t('Auto Zoom'),
      default: true,
    },
    viewport: {
      type: 'object',
      title: t('Viewport'),
    },
    
    // Arc Section
    color_scheme_type: {
      type: 'string',
      title: t('Color Scheme Type'),
      enum: [COLOR_SCHEME_TYPES.fixed_color, COLOR_SCHEME_TYPES.categorical_palette],
      default: COLOR_SCHEME_TYPES.fixed_color,
    },
    color_picker: {
      type: 'string',
      title: t('Source Color'),
      default: PRIMARY_COLOR,
    },
    target_color_picker: {
      type: 'string',
      title: t('Target Color'),
      default: PRIMARY_COLOR,
    },
    categorical_color: {
      type: 'string',
      title: t('Categorical Color'),
    },
    color_scheme: {
      type: 'string',
      title: t('Color scheme'),
      default: 'supersetColors',
    },
    stroke_width: {
      type: 'string',
      title: t('Stroke Width'),
      enum: ['1', '2', '3', '4', '5'],
      default: null,
    },
    legend_position: {
      type: 'string',
      title: t('Legend Position'),
    },
    legend_format: {
      type: 'string',
      title: t('Legend Format'),
    },
    
    // Advanced Section
    js_columns: {
      type: 'array',
      title: t('Extra data for JS'),
      items: { type: 'string' },
      default: [],
    },
    js_data_mutator: {
      type: 'string',
      title: t('Javascript data interceptor'),
    },
    js_tooltip: {
      type: 'string',
      title: t('Javascript tooltip generator'),
    },
    js_onclick_href: {
      type: 'string',
      title: t('Javascript onClick href'),
    },
  },
  required: ['start_spatial', 'end_spatial'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/start_spatial',
        options: {
          controlType: 'SpatialControl',
          validators: [validateNonEmpty],
          description: t('Point to your spatial columns'),
          mapStateToProps: (state: any) => ({
            choices: columnChoices(state.datasource),
          }),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/end_spatial',
        options: {
          controlType: 'SpatialControl',
          validators: [validateNonEmpty],
          description: t('Point to your spatial columns'),
          mapStateToProps: (state: any) => ({
            choices: columnChoices(state.datasource),
          }),
        },
      },
    ]),
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/row_limit',
        options: { controlType: 'RowLimitControl' },
      },
      {
        type: 'Control',
        scope: '#/properties/filter_nulls',
        options: { controlType: 'CheckboxControl' },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/adhoc_filters',
      options: { controlType: 'AdhocFiltersControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Map'), [
    {
      type: 'Control',
      scope: '#/properties/mapbox_style',
      options: { controlType: 'SelectControl' },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/autozoom',
        options: { controlType: 'CheckboxControl' },
      },
      {
        type: 'Control',
        scope: '#/properties/viewport',
        options: { controlType: 'ViewportControl' },
      },
    ]),
  ]),
  
  createCollapsibleGroup(t('Arc'), [
    {
      type: 'Control',
      scope: '#/properties/color_scheme_type',
      options: {
        controlType: 'SelectControl',
        choices: [
          [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
          [COLOR_SCHEME_TYPES.categorical_palette, t('Categorical palette')],
        ],
      },
    },
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/color_picker',
        options: {
          controlType: 'ColorPickerControl',
          description: t('Color of the source location'),
          renderTrigger: true,
          visibility: ({ controls }: any) =>
            isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.fixed_color),
        },
      },
      {
        type: 'Control',
        scope: '#/properties/target_color_picker',
        options: {
          controlType: 'ColorPickerControl',
          description: t('Color of the target location'),
          renderTrigger: true,
          visibility: ({ controls }: any) =>
            isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.fixed_color),
        },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/categorical_color',
      options: { controlType: 'CategoricalColorControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/color_scheme',
      options: { controlType: 'ColorSchemeControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/stroke_width',
      options: {
        controlType: 'SelectControl',
        freeForm: true,
        validators: [legacyValidateInteger],
        renderTrigger: true,
        choices: formatSelectOptions([1, 2, 3, 4, 5]),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/legend_position',
      options: { controlType: 'LegendPositionControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/legend_format',
      options: { controlType: 'LegendFormatControl' },
    },
  ]),
  
  createCollapsibleGroup(t('Advanced'), [
    {
      type: 'Control',
      scope: '#/properties/js_columns',
      options: { controlType: 'SelectControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/js_data_mutator',
      options: { controlType: 'TextAreaControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/js_tooltip',
      options: { controlType: 'TextAreaControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/js_onclick_href',
      options: { controlType: 'TextAreaControl' },
    },
  ]),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    size: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};

export default config;