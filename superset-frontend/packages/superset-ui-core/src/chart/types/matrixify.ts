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

import { AdhocMetric } from '../../query';

/**
 * Mode for selecting matrix axis values
 */
export type MatrixifyMode = 'metrics' | 'dimensions';

/**
 * Selection method for dimension values
 */
export type MatrixifySelectionMode = 'members' | 'topn';

/**
 * Sort order for top N selection
 */
export type MatrixifySortOrder = 'asc' | 'desc';

/**
 * Dimension value selection containing both the dimension column and selected values
 */
export interface MatrixifyDimensionValue {
  dimension: string;
  values: any[];
}

/**
 * Configuration for a single axis (rows or columns) in the matrix
 */
export interface MatrixifyAxisConfig {
  /** Whether to use metrics or dimensions for this axis */
  mode: MatrixifyMode;

  /** Selected metrics when mode is 'metrics' */
  metrics?: AdhocMetric[];

  /** Dimension selection mode when mode is 'dimensions' */
  selectionMode?: MatrixifySelectionMode;

  /** Selected dimension and values when mode is 'dimensions' */
  dimension?: MatrixifyDimensionValue;

  /** Top N value when selectionMode is 'topn' */
  topnValue?: number;

  /** Metric for ordering top N values */
  topnMetric?: AdhocMetric;

  /** Sort order for top N values */
  topnOrder?: MatrixifySortOrder;
}

/**
 * Complete Matrixify configuration in form data
 */
export interface MatrixifyFormData {
  // Enable/disable matrixify functionality
  matrixify_enabled?: boolean;

  // Row axis configuration
  matrixify_mode_rows?: MatrixifyMode;
  matrixify_rows?: AdhocMetric[];
  matrixify_dimension_selection_mode_rows?: MatrixifySelectionMode;
  matrixify_dimension_rows?: MatrixifyDimensionValue;
  matrixify_topn_value_rows?: number;
  matrixify_topn_metric_rows?: AdhocMetric;
  matrixify_topn_order_rows?: MatrixifySortOrder;

  // Column axis configuration
  matrixify_mode_columns?: MatrixifyMode;
  matrixify_columns?: AdhocMetric[];
  matrixify_dimension_selection_mode_columns?: MatrixifySelectionMode;
  matrixify_dimension_columns?: MatrixifyDimensionValue;
  matrixify_topn_value_columns?: number;
  matrixify_topn_metric_columns?: AdhocMetric;
  matrixify_topn_order_columns?: MatrixifySortOrder;

  // Grid layout configuration
  matrixify_row_height?: number;
  matrixify_fit_columns_dynamically?: boolean;
  matrixify_charts_per_row?: number;

  // Cell configuration
  matrixify_cell_title_template?: string;

  // Matrix display configuration
  matrixify_show_row_labels?: boolean;
  matrixify_show_column_headers?: boolean;
}

/**
 * Processed matrix configuration after form data is transformed
 */
export interface MatrixifyConfig {
  rows: MatrixifyAxisConfig;
  columns: MatrixifyAxisConfig;
}

/**
 * Helper function to extract Matrixify configuration from form data
 */
export function getMatrixifyConfig(
  formData: MatrixifyFormData & any,
): MatrixifyConfig | null {
  const hasRowConfig = formData.matrixify_mode_rows;
  const hasColumnConfig = formData.matrixify_mode_columns;

  if (!hasRowConfig && !hasColumnConfig) {
    return null;
  }

  return {
    rows: {
      mode: formData.matrixify_mode_rows || 'metrics',
      metrics: formData.matrixify_rows,
      selectionMode: formData.matrixify_dimension_selection_mode_rows,
      dimension: formData.matrixify_dimension_rows,
      topnValue: formData.matrixify_topn_value_rows,
      topnMetric: formData.matrixify_topn_metric_rows,
      topnOrder: formData.matrixify_topn_order_rows,
    },
    columns: {
      mode: formData.matrixify_mode_columns || 'metrics',
      metrics: formData.matrixify_columns,
      selectionMode: formData.matrixify_dimension_selection_mode_columns,
      dimension: formData.matrixify_dimension_columns,
      topnValue: formData.matrixify_topn_value_columns,
      topnMetric: formData.matrixify_topn_metric_columns,
      topnOrder: formData.matrixify_topn_order_columns,
    },
  };
}

/**
 * Check if Matrixify is enabled and properly configured
 */
export function isMatrixifyEnabled(formData: MatrixifyFormData): boolean {
  // First check if matrixify is explicitly enabled via checkbox
  if (!formData.matrixify_enabled) {
    return false;
  }

  // Then validate that we have proper configuration
  const config = getMatrixifyConfig(formData);
  if (!config) {
    return false;
  }

  const hasRowData =
    config.rows.mode === 'metrics'
      ? config.rows.metrics && config.rows.metrics.length > 0
      : config.rows.dimension?.dimension &&
        (config.rows.selectionMode === 'topn' ||
          (config.rows.dimension.values &&
            config.rows.dimension.values.length > 0));

  const hasColumnData =
    config.columns.mode === 'metrics'
      ? config.columns.metrics && config.columns.metrics.length > 0
      : config.columns.dimension?.dimension &&
        (config.columns.selectionMode === 'topn' ||
          (config.columns.dimension.values &&
            config.columns.dimension.values.length > 0));

  return Boolean(hasRowData || hasColumnData);
}

/**
 * Get validation errors for matrixify configuration
 */
export function getMatrixifyValidationErrors(
  formData: MatrixifyFormData,
): string[] {
  const errors: string[] = [];

  // Only validate if matrixify is enabled
  if (!formData.matrixify_enabled) {
    return errors;
  }

  const config = getMatrixifyConfig(formData);
  if (!config) {
    errors.push('Please configure at least one row or column axis');
    return errors;
  }

  // Check row configuration (only if explicitly set in form data)
  const hasRowMode = Boolean(formData.matrixify_mode_rows);
  if (hasRowMode) {
    const hasRowData =
      config.rows.mode === 'metrics'
        ? config.rows.metrics && config.rows.metrics.length > 0
        : config.rows.dimension?.dimension &&
          (config.rows.selectionMode === 'topn' ||
            (config.rows.dimension.values &&
              config.rows.dimension.values.length > 0));

    if (!hasRowData) {
      if (config.rows.mode === 'metrics') {
        errors.push('Please select at least one metric for rows');
      } else {
        errors.push('Please select a dimension and values for rows');
      }
    }
  }

  // Check column configuration (only if explicitly set in form data)
  const hasColumnMode = Boolean(formData.matrixify_mode_columns);
  if (hasColumnMode) {
    const hasColumnData =
      config.columns.mode === 'metrics'
        ? config.columns.metrics && config.columns.metrics.length > 0
        : config.columns.dimension?.dimension &&
          (config.columns.selectionMode === 'topn' ||
            (config.columns.dimension.values &&
              config.columns.dimension.values.length > 0));

    if (!hasColumnData) {
      if (config.columns.mode === 'metrics') {
        errors.push('Please select at least one metric for columns');
      } else {
        errors.push('Please select a dimension and values for columns');
      }
    }
  }

  // Must have at least one valid axis
  if (hasRowMode || hasColumnMode) {
    const hasRowData =
      config.rows.mode === 'metrics'
        ? config.rows.metrics && config.rows.metrics.length > 0
        : config.rows.dimension?.dimension &&
          (config.rows.selectionMode === 'topn' ||
            (config.rows.dimension.values &&
              config.rows.dimension.values.length > 0));

    const hasColumnData =
      config.columns.mode === 'metrics'
        ? config.columns.metrics && config.columns.metrics.length > 0
        : config.columns.dimension?.dimension &&
          (config.columns.selectionMode === 'topn' ||
            (config.columns.dimension.values &&
              config.columns.dimension.values.length > 0));

    if (!hasRowData && !hasColumnData) {
      errors.push('Configure at least one complete row or column axis');
    }
  } else {
    errors.push('Please configure at least one row or column axis');
  }

  return errors;
}

/**
 * Grid cell representing a single chart in the matrix
 */
export interface MatrixifyGridCell {
  /** Unique identifier for this cell */
  id: string;

  /** Row index in the grid */
  row: number;

  /** Column index in the grid */
  col: number;

  /** Row label (metric name or dimension value) */
  rowLabel: string;

  /** Column label (metric name or dimension value) */
  colLabel: string;

  /** Computed title for the cell (from template or default) */
  title?: string;

  /** Form data for this specific cell's chart */
  formData: any; // This will be QueryFormData with appropriate filters/metrics
}

/**
 * Complete grid structure for rendering
 */
export interface MatrixifyGrid {
  /** Row headers */
  rowHeaders: string[];

  /** Column headers */
  colHeaders: string[];

  /** 2D array of cells [row][col] */
  cells: (MatrixifyGridCell | null)[][];

  /** Original form data used to generate the grid */
  baseFormData: MatrixifyFormData;
}
