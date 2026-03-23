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

// Utility function to check if matrixify controls should be visible
const isMatrixifyVisible = (
  controls: any,
  axis: 'rows' | 'columns',
  mode?: 'metrics' | 'dimensions',
  selectionMode?: 'members' | 'topn' | 'all',
) => {
  if (controls?.matrixify_enable?.value !== true) return false;

  const modeControl = `matrixify_mode_${axis}`;
  const selectionModeControl = `matrixify_dimension_selection_mode_${axis}`;

  const modeValue = controls?.[modeControl]?.value;
  const isLayoutEnabled = modeValue === 'metrics' || modeValue === 'dimensions';

  if (!isLayoutEnabled) return false;

  if (mode) {
    if (modeValue !== mode) return false;

    if (selectionMode && mode === 'dimensions') {
      return controls?.[selectionModeControl]?.value === selectionMode;
    }
  }

  return true;
};

// Initialize the controls object that will be populated dynamically
const matrixifyControls: Record<string, SharedControlConfig<any>> = {};

// Dynamically add axis-specific controls (rows and columns)
(['columns', 'rows'] as const).forEach(axisParam => {
  const axis: 'rows' | 'columns' = axisParam;
  const otherAxis: 'rows' | 'columns' = axis === 'rows' ? 'columns' : 'rows';

  matrixifyControls[`matrixify_mode_${axis}`] = {
    type: 'RadioButtonControl',
    default: 'disabled',
    renderTrigger: true,
    tabOverride: 'matrixify',
    mapStateToProps: ({ controls }) => {
      const otherAxisControlName = `matrixify_mode_${otherAxis}`;

      const otherAxisValue =
        controls?.[otherAxisControlName]?.value ?? 'disabled';

      const isMetricsDisabled = otherAxisValue === 'metrics';

      return {
        options: [
          { value: 'disabled', label: t('Disabled') },
          {
            value: 'metrics',
            label: t('Metrics'),
            disabled: isMetricsDisabled,
            tooltip: isMetricsDisabled
              ? t(
                  "Metrics can't be used for both rows and columns at the same time",
                )
              : undefined,
          },
          { value: 'dimensions', label: t('Dimensions') },
        ],
      };
    },
    rerender: [`matrixify_mode_${otherAxis}`, `matrixify_dimension_${axis}`],
  };

  matrixifyControls[`matrixify_${axis}`] = {
    ...dndAdhocMetricControl,
    label: t(`Metrics`),
    multi: true,
    validators: [], // No validation - rely on visibility
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) => isMatrixifyVisible(controls, axis, 'metrics'),
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
        `matrixify_all_sort_by_${axis}`,
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

      const isVisible = isMatrixifyVisible(controls, axis, 'dimensions');

      // Validate dimension is selected when visible
      const dimensionValidator = (value: any) => {
        if (!value?.dimension) {
          return t('Dimension is required');
        }
        return false;
      };

      // Additional validation for topN mode
      const validators = isVisible
        ? [dimensionValidator, validateNonEmpty]
        : [];

      return {
        datasource,
        selectionMode,
        topNMetric: getValue(`matrixify_topn_metric_${axis}`),
        topNValue: getValue(`matrixify_topn_value_${axis}`),
        topNOrder: getValue(`matrixify_topn_order_${axis}`, true)
          ? 'DESC'
          : 'ASC',
        allSortBy: getValue(`matrixify_all_sort_by_${axis}`, 'a_to_z'),
        formData: form_data,
        validators,
      };
    },
    visibility: ({ controls }) =>
      isMatrixifyVisible(controls, axis, 'dimensions'),
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

  // Add selection mode control (Dimension Members / Top N / All)
  matrixifyControls[`matrixify_dimension_selection_mode_${axis}`] = {
    type: 'VerticalRadioControl',
    label: t(`Selection method`),
    default: 'members',
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      isMatrixifyVisible(controls, axis, 'dimensions'),
    options: [
      { value: 'members', label: t('Dimension members') },
      { value: 'topn', label: t('Top n') },
      {
        value: 'all',
        label: t('All dimensions'),
        tooltip: t('Uses the first 25 values if the dimension has more.'),
      },
    ],
  };

  // TopN controls
  matrixifyControls[`matrixify_topn_value_${axis}`] = {
    type: 'NumberControl',
    label: t(`Number of top values`),
    description: t(`How many top values to select`),
    default: 10,
    isInt: true,
    validators: [],
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      isMatrixifyVisible(controls, axis, 'dimensions', 'topn'),
    mapStateToProps: ({ controls }) => {
      const isVisible = isMatrixifyVisible(
        controls,
        axis,
        'dimensions',
        'topn',
      );

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
      isMatrixifyVisible(controls, axis, 'dimensions', 'topn') ||
      (isMatrixifyVisible(controls, axis, 'dimensions', 'all') &&
        controls?.[`matrixify_all_sort_by_${axis}`]?.value === 'metric'),
    mapStateToProps: (state, controlState) => {
      const { controls, datasource } = state;
      const isVisible =
        isMatrixifyVisible(controls, axis, 'dimensions', 'topn') ||
        (isMatrixifyVisible(controls, axis, 'dimensions', 'all') &&
          controls?.[`matrixify_all_sort_by_${axis}`]?.value === 'metric');

      const originalProps =
        dndAdhocMetricControl.mapStateToProps?.(state, controlState) || {};

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
    type: 'CheckboxControl',
    label: t('Sort descending'),
    default: true,
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      isMatrixifyVisible(controls, axis, 'dimensions', 'topn') ||
      (isMatrixifyVisible(controls, axis, 'dimensions', 'all') &&
        controls?.[`matrixify_all_sort_by_${axis}`]?.value === 'metric'),
  };

  matrixifyControls[`matrixify_all_sort_by_${axis}`] = {
    type: 'SelectControl',
    label: t('Sort by'),
    default: 'a_to_z',
    clearable: false,
    renderTrigger: true,
    tabOverride: 'matrixify',
    visibility: ({ controls }) =>
      isMatrixifyVisible(controls, axis, 'dimensions', 'all'),
    choices: [
      ['a_to_z', t('A-Z')],
      ['z_to_a', t('Z-A')],
      ['metric', t('Metric')],
    ],
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
    isMatrixifyVisible(controls, 'rows') ||
    isMatrixifyVisible(controls, 'columns'),
};

// Matrix display controls
matrixifyControls.matrixify_show_row_labels = {
  type: 'CheckboxControl',
  label: t('Show row labels'),
  description: t('Display labels for each row on the left side of the matrix'),
  default: true,
  renderTrigger: true,
  tabOverride: 'matrixify',
  visibility: ({ controls }) => isMatrixifyVisible(controls, 'rows'),
};

matrixifyControls.matrixify_show_column_headers = {
  type: 'CheckboxControl',
  label: t('Show column headers'),
  description: t('Display headers for each column at the top of the matrix'),
  default: true,
  renderTrigger: true,
  tabOverride: 'matrixify',
  visibility: ({ controls }) => isMatrixifyVisible(controls, 'columns'),
};

export { matrixifyControls, isMatrixifyVisible };
