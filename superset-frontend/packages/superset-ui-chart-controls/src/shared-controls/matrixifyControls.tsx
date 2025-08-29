/* eslint-disable camelcase */
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
import { SharedControlConfig } from '../types';
import { dndAdhocMetricControl } from './dndControls';

/**
 * Matrixify control definitions
 * Controls for transforming charts into matrix/grid layouts
 */

// Initialize the controls object that will be populated dynamically
const matrixifyControls: Record<string, SharedControlConfig<any>> = {};

// Dynamically add axis-specific controls (rows and columns)
['columns', 'rows'].forEach(axisParam => {
  const axis = axisParam; // Capture the value in a local variable

  matrixifyControls[`matrixify_mode_${axis}`] = {
    type: 'RadioButtonControl',
    label: t(`Metrics / Dimensions`),
    default: 'metrics',
    options: [
      ['metrics', t('Metrics')],
      ['dimensions', t('Dimension members')],
    ],
    renderTrigger: true,
  };

  matrixifyControls[`matrixify_${axis}`] = {
    ...dndAdhocMetricControl,
    label: t(`Metrics`),
    multi: true,
    validators: [], // Not required
    // description: t(`Select metrics for ${axis}`),
    renderTrigger: true,
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'metrics',
  };

  // Combined dimension and values control
  matrixifyControls[`matrixify_dimension_${axis}`] = {
    type: 'MatrixifyDimensionControl',
    label: t(`Dimension selection`),
    description: t(`Select dimension and values`),
    default: { dimension: '', values: [] },
    validators: [], // Not required
    renderTrigger: true,
    shouldMapStateToProps: (prevState, state) => {
      // Recalculate when any relevant form_data field changes
      const fieldsToCheck = [
        `matrixify_topn_value_${axis}`,
        `matrixify_topn_metric_${axis}`,
        `matrixify_topn_order_${axis}`,
        `matrixify_dimension_selection_mode_${axis}`,
      ];

      return fieldsToCheck.some(
        field => prevState?.form_data?.[field] !== state?.form_data?.[field],
      );
    },
    mapStateToProps: ({ datasource, controls, form_data }) => {
      // Helper to get value from form_data or controls
      const getValue = (key: string, defaultValue?: any) =>
        form_data?.[key] ?? controls?.[key]?.value ?? defaultValue;

      return {
        datasource,
        selectionMode: getValue(
          `matrixify_dimension_selection_mode_${axis}`,
          'members',
        ),
        topNMetric: getValue(`matrixify_topn_metric_${axis}`),
        topNValue: getValue(`matrixify_topn_value_${axis}`),
        topNOrder: getValue(`matrixify_topn_order_${axis}`),
        formData: form_data,
      };
    },
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions',
  };

  // Dimension picker for TopN mode (just dimension, no values)
  // NOTE: This is now handled by matrixify_dimension control, so hiding it
  matrixifyControls[`matrixify_topn_dimension_${axis}`] = {
    type: 'SelectControl',
    label: t('Dimension'),
    description: t(`Select dimension for Top N`),
    default: null,
    mapStateToProps: ({ datasource }) => ({
      choices:
        datasource?.columns?.map((col: any) => [
          col.column_name,
          col.column_name,
        ]) || [],
    }),
    renderTrigger: true,
    // Hide this control - now handled by matrixify_dimension control
    visibility: () => false,
  };

  // Add selection mode control (Dimension Members vs TopN)
  matrixifyControls[`matrixify_dimension_selection_mode_${axis}`] = {
    type: 'RadioButtonControl',
    label: t(`Selection method`),
    default: 'members',
    options: [
      ['members', t('Dimension members')],
      ['topn', t('Top n')],
    ],
    renderTrigger: true,
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions',
  };

  // TopN controls
  matrixifyControls[`matrixify_topn_value_${axis}`] = {
    type: 'TextControl',
    label: t(`Number of top values`),
    description: t(`How many top values to select`),
    default: 10,
    isInt: true,
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
      controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value ===
        'topn',
  };

  matrixifyControls[`matrixify_topn_metric_${axis}`] = {
    ...dndAdhocMetricControl,
    label: t(`Metric for ordering`),
    multi: false,
    validators: [], // Not required
    description: t(`Metric to use for ordering Top N values`),
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
      controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value ===
        'topn',
  };

  matrixifyControls[`matrixify_topn_order_${axis}`] = {
    type: 'RadioButtonControl',
    label: t(`Sort order`),
    default: 'desc',
    options: [
      ['asc', t('Ascending')],
      ['desc', t('Descending')],
    ],
    visibility: ({ controls }) =>
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
      controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value ===
        'topn',
  };
});

// Grid layout controls (added once, not per axis)
matrixifyControls.matrixify_row_height = {
  type: 'TextControl',
  label: t('Row height'),
  description: t('Height of each row in pixels'),
  default: 300,
  isInt: true,
  validators: [],
  renderTrigger: true,
};

matrixifyControls.matrixify_fit_columns_dynamically = {
  type: 'CheckboxControl',
  label: t('Fit columns dynamically'),
  description: t('Automatically adjust column width based on available space'),
  default: true,
  renderTrigger: true,
};

matrixifyControls.matrixify_charts_per_row = {
  type: 'SelectControl',
  label: t('Charts per row'),
  description: t('Number of charts to display per row'),
  default: 4,
  choices: [
    [1, '1'],
    [2, '2'],
    [3, '3'],
    [4, '4'],
    [5, '5'],
    [6, '6'],
    [8, '8'],
    [10, '10'],
    [12, '12'],
  ],
  freeForm: true,
  clearable: false,
  renderTrigger: true,
  visibility: ({ controls }) =>
    !controls?.matrixify_fit_columns_dynamically?.value,
};

// Main enable control
matrixifyControls.matrixify_enabled = {
  type: 'CheckboxControl',
  label: t('Enable matrixify'),
  description: t(
    'Transform this chart into a matrix/grid of charts based on dimensions or metrics',
  ),
  default: false,
  renderTrigger: true,
};

// Cell title control for Matrixify
matrixifyControls.matrixify_cell_title_template = {
  type: 'TextControl',
  label: t('Title'),
  description: t(
    'Customize cell titles using Handlebars template syntax. Available variables: {{rowLabel}}, {{colLabel}}',
  ),
  default: '',
  renderTrigger: true,
  visibility: ({ controls }) =>
    (controls?.matrixify_mode_rows?.value ||
      controls?.matrixify_mode_columns?.value) !== undefined,
};

// Matrix display controls
matrixifyControls.matrixify_show_row_labels = {
  type: 'CheckboxControl',
  label: t('Show row labels'),
  description: t('Display labels for each row on the left side of the matrix'),
  default: true,
  renderTrigger: true,
  visibility: ({ controls }) =>
    (controls?.matrixify_mode_rows?.value ||
      controls?.matrixify_mode_columns?.value) !== undefined,
};

matrixifyControls.matrixify_show_column_headers = {
  type: 'CheckboxControl',
  label: t('Show column headers'),
  description: t('Display headers for each column at the top of the matrix'),
  default: true,
  renderTrigger: true,
  visibility: ({ controls }) =>
    (controls?.matrixify_mode_rows?.value ||
      controls?.matrixify_mode_columns?.value) !== undefined,
};

export { matrixifyControls };
