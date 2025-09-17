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

import Handlebars from 'handlebars';
import type { QueryFormData } from '../../../query';
import type {
  AdhocFilter,
  BinaryAdhocFilter,
} from '../../../query/types/Filter';
import {
  MatrixifyGrid,
  MatrixifyGridCell,
  MatrixifyFormData,
  getMatrixifyConfig,
  MatrixifyAxisConfig,
  MatrixifyFilterConstants,
} from '../../types/matrixify';

/**
 * Generate title from template using Handlebars
 */
function generateCellTitle(
  rowLabel: string,
  colLabel: string,
  template?: string,
): string {
  if (!template) {
    return '';
  }

  try {
    // Compile the Handlebars template with noEscape option to prevent HTML entity encoding
    const compiledTemplate = Handlebars.compile(template, { noEscape: true });

    // Create context with both naming conventions for flexibility
    const context = {
      row: rowLabel,
      rowLabel,
      column: colLabel,
      columnLabel: colLabel,
      col: colLabel,
      colLabel,
    };

    // Render the template with the context
    return compiledTemplate(context);
  } catch (error) {
    // If template compilation fails, return empty string
    console.warn('Failed to compile Handlebars template:', error);
    return '';
  }
}

/**
 * Extract label from a metric or dimension value
 */
function getAxisLabel(axisConfig: MatrixifyAxisConfig, index: number): string {
  if (axisConfig.mode === 'metrics') {
    const metric = axisConfig.metrics?.[index];
    if (!metric) return '';
    // Handle both saved metrics and adhoc metrics
    if (typeof metric === 'string') {
      return metric;
    }
    return metric.label || '';
  }

  // For dimensions mode
  const dimensionValue = axisConfig.dimension?.values[index];
  return dimensionValue?.toString() || '';
}

/**
 * Create filter for a specific dimension value
 * Using Matrixify-specific constants that match the literal types defined in Filter.ts
 */
function createDimensionFilter(
  dimension: string,
  value: any,
): BinaryAdhocFilter {
  return {
    expressionType: MatrixifyFilterConstants.ExpressionType.SIMPLE,
    subject: dimension,
    operator: MatrixifyFilterConstants.Operator.EQUALS,
    comparator: value,
    clause: MatrixifyFilterConstants.Clause.WHERE,
    isExtra: false,
  };
}

/**
 * Generate form data for a specific grid cell
 */
function generateCellFormData(
  baseFormData: QueryFormData & MatrixifyFormData,
  rowConfig: MatrixifyAxisConfig | null,
  colConfig: MatrixifyAxisConfig | null,
  rowIndex: number | null,
  colIndex: number | null,
): QueryFormData {
  // Start with a clean copy of the base formData
  const cellFormData: any = { ...baseFormData };

  // Remove Matrixify-specific fields since cells shouldn't be matrixified
  Object.keys(cellFormData).forEach(key => {
    if (key.startsWith('matrixify_')) {
      delete cellFormData[key];
    }
  });

  // Override fields that could cause issues in grid cells
  const overrides: Partial<QueryFormData> = {
    slice_name: undefined,
    slice_id: undefined,
    header_font_size: undefined,
    subheader: undefined,
    show_title: undefined,
    header_title_text_align: undefined,
    header_text: undefined,
  };

  // Apply overrides
  Object.assign(cellFormData, overrides);

  // Add filters for dimension-based axes
  const additionalFilters: AdhocFilter[] = [];

  if (
    rowConfig &&
    rowIndex !== null &&
    rowConfig.mode === 'dimensions' &&
    rowConfig.dimension
  ) {
    const value = rowConfig.dimension.values[rowIndex];
    if (value !== undefined) {
      additionalFilters.push(
        createDimensionFilter(rowConfig.dimension.dimension, value),
      );
    }
  }

  if (
    colConfig &&
    colIndex !== null &&
    colConfig.mode === 'dimensions' &&
    colConfig.dimension
  ) {
    const value = colConfig.dimension.values[colIndex];
    if (value !== undefined) {
      additionalFilters.push(
        createDimensionFilter(colConfig.dimension.dimension, value),
      );
    }
  }

  // Add filters to existing adhoc_filters
  if (additionalFilters.length > 0) {
    cellFormData.adhoc_filters = [
      ...(cellFormData.adhoc_filters || []),
      ...additionalFilters,
    ];
  }

  // Set metrics based on row/column configuration
  const metrics = [];

  if (rowConfig && rowIndex !== null && rowConfig.mode === 'metrics') {
    const metric = rowConfig.metrics?.[rowIndex];
    if (metric) {
      metrics.push(metric);
    }
  }

  if (colConfig && colIndex !== null && colConfig.mode === 'metrics') {
    const metric = colConfig.metrics?.[colIndex];
    if (metric) {
      metrics.push(metric);
    }
  }

  // If we have metrics from the matrix, use them; otherwise keep original
  if (metrics.length > 0) {
    cellFormData.metrics = metrics;
  }

  return cellFormData;
}

/**
 * Generate a complete grid structure from Matrixify configuration
 */
export function generateMatrixifyGrid(
  formData: QueryFormData & MatrixifyFormData,
): MatrixifyGrid | null {
  const config = getMatrixifyConfig(formData);
  if (!config) {
    return null;
  }

  // Determine row headers and count
  let rowHeaders: string[] = [];
  let rowCount = 0;

  if (config.rows.mode === 'metrics' && config.rows.metrics) {
    rowCount = config.rows.metrics.length;
    rowHeaders = config.rows.metrics.map((_, idx) =>
      getAxisLabel(config.rows, idx),
    );
  } else if (
    config.rows.mode === 'dimensions' &&
    config.rows.dimension?.values
  ) {
    rowCount = config.rows.dimension.values.length;
    rowHeaders = config.rows.dimension.values.map((_, idx) =>
      getAxisLabel(config.rows, idx),
    );
  }

  // Determine column headers and count
  let colHeaders: string[] = [];
  let colCount = 0;

  if (config.columns.mode === 'metrics' && config.columns.metrics) {
    colCount = config.columns.metrics.length;
    colHeaders = config.columns.metrics.map((_, idx) =>
      getAxisLabel(config.columns, idx),
    );
  } else if (
    config.columns.mode === 'dimensions' &&
    config.columns.dimension?.values
  ) {
    colCount = config.columns.dimension.values.length;
    colHeaders = config.columns.dimension.values.map((_, idx) =>
      getAxisLabel(config.columns, idx),
    );
  }

  // If only rows are configured, create a single column grid
  if (rowCount > 0 && colCount === 0) {
    colCount = 1;
    colHeaders = [''];
  }

  // If only columns are configured, create a single row grid
  if (colCount > 0 && rowCount === 0) {
    rowCount = 1;
    rowHeaders = [''];
  }

  // Generate grid cells
  const cells: (MatrixifyGridCell | null)[][] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const rowCells: (MatrixifyGridCell | null)[] = [];

    for (let col = 0; col < colCount; col += 1) {
      const id = `cell-${row}-${col}`;
      const rowLabel = rowHeaders[row];
      const colLabel = colHeaders[col];

      const cellFormData = generateCellFormData(
        formData,
        rowCount > 0 ? config.rows : null,
        colCount > 0 ? config.columns : null,
        rowCount > 0 ? row : null,
        colCount > 0 ? col : null,
      );

      // Generate title using template if provided
      const title = generateCellTitle(
        rowLabel,
        colLabel,
        formData.matrixify_cell_title_template,
      );

      rowCells.push({
        id,
        row,
        col,
        rowLabel,
        colLabel,
        title,
        formData: cellFormData,
      });
    }

    cells.push(rowCells);
  }

  return {
    rowHeaders,
    colHeaders,
    cells,
    baseFormData: formData,
  };
}
