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

import { t, validateNonEmpty } from '@superset-ui/core';
import { SharedControlConfig } from '../types';
import { dndAdhocMetricControl } from './dndControls';
import { defineSavedMetrics } from '../utils';

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
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true,
  };

  matrixifyControls[`matrixify_${axis}`] = {
    ...dndAdhocMetricControl,
    label: t(`Metrics`),
    multi: true,
    validators: [], // No validation - rely on visibility
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
      controls?.[`matrixify_mode_${axis}`]?.value === 'metrics',
  };

  // Combined dimension and values control
  matrixifyControls[`matrixify_dimension_${axis}`] = {
    type: 'MatrixifyDimensionControl',
    label: t(`Dimension selection`),
    description: t(`Select dimension and values`),
    default: { dimension: '', values: [] },
    validators: [], // No validation - rely on visibility
    renderTrigger: true,
    tabOverride: 'matrixify',
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

      const selectionMode = getValue(
        `matrixify_dimension_selection_mode_${axis}`,
        'members',
      );

      return {
        datasource,
        selectionMode,
        topNMetric: getValue(`matrixify_topn_metric_${axis}`),
        topNValue: getValue(`matrixify_topn_value_${axis}`),
        topNOrder: getValue(`matrixify_topn_order_${axis}`),
        formData: form_data,
      };
    },
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions',
  };

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
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions',
  };

  // TopN controls
  matrixifyControls[`matrixify_topn_value_${axis}`] = {
    type: 'TextControl',
    label: t(`Number of top values`),
    description: t(`How many top values to select`),
    default: 10,
    isInt: true,
    validators: [],
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
      controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value ===
        'topn',
    mapStateToProps: ({ controls }) => {
      const isVisible = 
        controls?.[
          `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
        ]?.value === true &&
        controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
        controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value === 'topn';
      
      return {
        validators: isVisible ? [validateNonEmpty] : [],
      };
    },
  };

  matrixifyControls[`matrixify_topn_metric_${axis}`] = {
    ...dndAdhocMetricControl,
    label: t(`Metric for ordering`),
    multi: false,
    validators: [],
    description: t(`Metric to use for ordering Top N values`),
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
      controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
      controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value ===
        'topn',
    mapStateToProps: (state) => {
      const { controls, datasource } = state;
      const isVisible = 
        controls?.[
          `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
        ]?.value === true &&
        controls?.[`matrixify_mode_${axis}`]?.value === 'dimensions' &&
        controls?.[`matrixify_dimension_selection_mode_${axis}`]?.value === 'topn';
      
      // Get the original props from dndAdhocMetricControl's mapStateToProps
      const originalProps = dndAdhocMetricControl.mapStateToProps?.(state) || {};
      
      return {
        ...originalProps,
        columns: datasource?.columns || [],
        savedMetrics: defineSavedMetrics(datasource),
        datasource,
        datasourceType: datasource?.type,
        validators: isVisible ? [validateNonEmpty] : [],
      };
    },
  };

  matrixifyControls[`matrixify_topn_order_${axis}`] = {
    type: 'RadioButtonControl',
    label: t(`Sort order`),
    default: 'desc',
    options: [
      ['asc', t('Ascending')],
      ['desc', t('Descending')],
    ],
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      controls?.[
        `matrixify_enable_${axis === 'rows' ? 'vertical' : 'horizontal'}_layout`
      ]?.value === true &&
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

matrixifyControls.matrixify_enable_vertical_layout = {
  type: 'CheckboxControl',
  label: t('Enable vertical layout (rows)'),
  description: t('Create matrix rows by stacking charts vertically'),
  default: false,
  renderTrigger: true,
  tabOverride: 'matrixify',
};

matrixifyControls.matrixify_enable_horizontal_layout = {
  type: 'CheckboxControl',
  label: t('Enable horizontal layout (columns)'),
  description: t('Create matrix columns by placing charts side-by-side'),
  default: false,
  renderTrigger: true,
  tabOverride: 'matrixify',
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
    controls?.matrixify_enable_vertical_layout?.value === true ||
    controls?.matrixify_enable_horizontal_layout?.value === true,
};

// Matrix display controls
matrixifyControls.matrixify_show_row_labels = {
  type: 'CheckboxControl',
  label: t('Show row labels'),
  description: t('Display labels for each row on the left side of the matrix'),
  default: true,
  renderTrigger: true,
  tabOverride: 'matrixify',
  visibility: ({ controls }) =>
    controls?.matrixify_enable_vertical_layout?.value === true,
};

matrixifyControls.matrixify_show_column_headers = {
  type: 'CheckboxControl',
  label: t('Show column headers'),
  description: t('Display headers for each column at the top of the matrix'),
  default: true,
  renderTrigger: true,
  tabOverride: 'matrixify',
  visibility: ({ controls }) =>
    controls?.matrixify_enable_horizontal_layout?.value === true,
};

export { matrixifyControls };
