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
import {
  ensureIsArray,
  getColumnLabel,
  isQueryFormColumn,
  JsonValue,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { DatasourcesState, Slice, WhatIfColumn } from '../types';

/**
 * Type definitions for form_data structures used in what-if analysis.
 * These are local types for the subset of form_data we need to inspect.
 */

/** Metric definition in form_data */
interface FormDataMetric {
  expressionType?: 'SIMPLE' | 'SQL';
  column?: string | { column_name: string };
  aggregate?: string;
  sqlExpression?: string;
  label?: string;
}

/** Filter definition in form_data */
interface FormDataFilter {
  expressionType?: 'SIMPLE' | 'SQL';
  subject?: string;
  operator?: string;
  comparator?: JsonValue;
  sqlExpression?: string;
  clause?: string;
}

/**
 * Check if a column is numeric based on its type_generic field
 */
export function isNumericColumn(column: ColumnMeta): boolean {
  return column.type_generic === GenericDataType.Numeric;
}

/**
 * Collect all SQL expressions from a slice's form_data.
 * This includes:
 * - Metrics with expressionType: 'SQL' (sqlExpression)
 * - Filters with expressionType: 'SQL' (sqlExpression)
 * - Adhoc columns in groupby, x_axis, series, etc. (sqlExpression)
 */
export function collectSqlExpressionsFromSlice(slice: Slice): string[] {
  const expressions: string[] = [];
  const formData = slice.form_data;
  if (!formData) return expressions;

  // Helper to extract sqlExpression from adhoc columns
  const addAdhocColumnExpression = (col: unknown) => {
    if (
      col &&
      typeof col === 'object' &&
      'sqlExpression' in col &&
      typeof (col as { sqlExpression: unknown }).sqlExpression === 'string'
    ) {
      expressions.push((col as { sqlExpression: string }).sqlExpression);
    }
  };

  // Extract SQL expressions from metrics
  ensureIsArray(formData.metrics).forEach((metric: unknown) => {
    if (
      metric &&
      typeof metric === 'object' &&
      'expressionType' in metric &&
      (metric as { expressionType: unknown }).expressionType === 'SQL' &&
      'sqlExpression' in metric &&
      typeof (metric as { sqlExpression: unknown }).sqlExpression === 'string'
    ) {
      expressions.push((metric as { sqlExpression: string }).sqlExpression);
    }
  });

  // Extract SQL expression from singular metric
  if (
    formData.metric &&
    typeof formData.metric === 'object' &&
    'expressionType' in formData.metric &&
    (formData.metric as { expressionType: unknown }).expressionType === 'SQL' &&
    'sqlExpression' in formData.metric &&
    typeof (formData.metric as { sqlExpression: unknown }).sqlExpression ===
      'string'
  ) {
    expressions.push(
      (formData.metric as { sqlExpression: string }).sqlExpression,
    );
  }

  // Extract SQL expressions from filters
  ensureIsArray(formData.adhoc_filters).forEach((filter: unknown) => {
    if (
      filter &&
      typeof filter === 'object' &&
      'expressionType' in filter &&
      (filter as { expressionType: unknown }).expressionType === 'SQL' &&
      'sqlExpression' in filter &&
      typeof (filter as { sqlExpression: unknown }).sqlExpression === 'string'
    ) {
      expressions.push((filter as { sqlExpression: string }).sqlExpression);
    }
  });

  // Extract SQL expressions from adhoc columns in groupby, x_axis, series, columns, entity
  ensureIsArray(formData.groupby).forEach(addAdhocColumnExpression);
  ensureIsArray(formData.columns).forEach(addAdhocColumnExpression);

  if (formData.x_axis) {
    addAdhocColumnExpression(formData.x_axis);
  }
  if (formData.series) {
    addAdhocColumnExpression(formData.series);
  }
  if (formData.entity) {
    addAdhocColumnExpression(formData.entity);
  }

  return expressions;
}

/**
 * Find column names that appear in SQL expressions.
 * Uses word boundary matching to avoid false positives
 * (e.g., "order" shouldn't match "order_id" or "reorder").
 */
export function findColumnsInSqlExpressions(
  sqlExpressions: string[],
  columnNames: string[],
): Set<string> {
  const foundColumns = new Set<string>();

  if (sqlExpressions.length === 0 || columnNames.length === 0) {
    return foundColumns;
  }

  // Combine all SQL expressions into one string for efficient searching
  const combinedSql = sqlExpressions.join(' ');

  columnNames.forEach(columnName => {
    // Use word boundary regex to match exact column names
    // Escape special regex characters in column name
    const escapedName = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match column name surrounded by word boundaries or common SQL delimiters
    const regex = new RegExp(
      `(^|[^a-zA-Z0-9_])${escapedName}([^a-zA-Z0-9_]|$)`,
    );
    if (regex.test(combinedSql)) {
      foundColumns.add(columnName);
    }
  });

  return foundColumns;
}

/**
 * Extract column names from a slice's form_data
 * This includes columns from groupby, metrics, x_axis, series, filters, etc.
 */
export function extractColumnsFromSlice(slice: Slice): Set<string> {
  const columns = new Set<string>();
  const formData = slice.form_data;
  if (!formData) return columns;

  // Helper to add column - handles both physical columns (strings) and adhoc columns
  const addColumn = (col: unknown) => {
    if (isQueryFormColumn(col)) {
      const label = getColumnLabel(col);
      if (label) columns.add(label);
    }
  };

  // Extract groupby columns (can be physical or adhoc)
  ensureIsArray(formData.groupby).forEach(addColumn);

  // Extract x_axis column (can be physical or adhoc)
  if (formData.x_axis) {
    addColumn(formData.x_axis);
  }

  // Extract metrics - get column names from metric definitions
  ensureIsArray(formData.metrics).forEach((metric: string | FormDataMetric) => {
    if (typeof metric === 'string') {
      // Saved metric name - we can't extract columns from it
      return;
    }
    if (metric && typeof metric === 'object' && 'column' in metric) {
      const metricColumn = metric.column;
      if (typeof metricColumn === 'string') {
        columns.add(metricColumn);
      } else if (metricColumn && typeof metricColumn === 'object' && 'column_name' in metricColumn) {
        columns.add(metricColumn.column_name);
      }
    }
  });

  // Extract metric (singular) - used by pie charts and other single-metric charts
  if (formData.metric && typeof formData.metric === 'object') {
    const metric = formData.metric as FormDataMetric;
    if ('column' in metric && metric.column) {
      const metricColumn = metric.column;
      if (typeof metricColumn === 'string') {
        columns.add(metricColumn);
      } else if (typeof metricColumn === 'object' && 'column_name' in metricColumn) {
        columns.add(metricColumn.column_name);
      }
    }
  }

  // Extract series column (can be physical or adhoc)
  if (formData.series) {
    addColumn(formData.series);
  }

  // Extract entity column
  if (formData.entity) {
    addColumn(formData.entity);
  }

  // Extract columns from filters
  ensureIsArray(formData.adhoc_filters).forEach((filter: FormDataFilter) => {
    if (filter?.subject && typeof filter.subject === 'string') {
      columns.add(filter.subject);
    }
  });

  // Extract columns array (used by some chart types like box_plot)
  ensureIsArray(formData.columns).forEach(addColumn);

  return columns;
}

/**
 * Get the datasource key from a slice's form_data
 * Format: "datasourceId__datasourceType" e.g., "2__table"
 */
export function getDatasourceKey(slice: Slice): string | null {
  const datasource = slice.form_data?.datasource;
  if (!datasource || typeof datasource !== 'string') return null;
  return datasource;
}

/**
 * Get numeric columns used by slices on a dashboard
 * Returns columns grouped by their usage across slices
 *
 * Uses sliceEntities.slices instead of charts state because it changes less
 * frequently (only on slice metadata updates, not on every query result change)
 */
export function getNumericColumnsForDashboard(
  slices: { [id: number]: Slice },
  datasources: DatasourcesState,
): WhatIfColumn[] {
  const columnMap = new Map<string, WhatIfColumn>();

  Object.values(slices).forEach(slice => {
    const chartId = slice.slice_id;
    const datasourceKey = getDatasourceKey(slice);
    if (!datasourceKey) return;

    const datasource = datasources[datasourceKey];
    if (!datasource?.columns) return;

    // Extract columns explicitly referenced by this slice
    const referencedColumns = extractColumnsFromSlice(slice);

    // Also check SQL expressions for column references
    const sqlExpressions = collectSqlExpressionsFromSlice(slice);
    if (sqlExpressions.length > 0) {
      // Get all numeric column names from this datasource
      const numericColumnNames = datasource.columns
        .filter((c: ColumnMeta) => isNumericColumn(c))
        .map((c: ColumnMeta) => c.column_name);

      // Find which numeric columns are referenced in SQL expressions
      const sqlReferencedColumns = findColumnsInSqlExpressions(
        sqlExpressions,
        numericColumnNames,
      );

      // Add SQL-referenced columns to the set
      sqlReferencedColumns.forEach(colName => referencedColumns.add(colName));
    }

    // For each referenced column, check if it's numeric
    referencedColumns.forEach(colName => {
      const colMetadata = datasource.columns.find(
        (c: ColumnMeta) => c.column_name === colName,
      );

      if (colMetadata && isNumericColumn(colMetadata)) {
        // Create a unique key for this column (datasource + column name)
        const key = `${datasource.id}:${colName}`;

        if (!columnMap.has(key)) {
          columnMap.set(key, {
            columnName: colName,
            datasourceId: datasource.id,
            usedByChartIds: [chartId],
            description: colMetadata.description,
            verboseName: colMetadata.verbose_name,
          });
        } else {
          const existing = columnMap.get(key)!;
          if (!existing.usedByChartIds.includes(chartId)) {
            existing.usedByChartIds.push(chartId);
          }
        }
      }
    });
  });

  return Array.from(columnMap.values());
}

/**
 * Check if a slice uses a specific column.
 * Checks both explicitly referenced columns and columns in SQL expressions.
 */
export function sliceUsesColumn(slice: Slice, columnName: string): boolean {
  const columns = extractColumnsFromSlice(slice);
  if (columns.has(columnName)) {
    return true;
  }

  // Also check SQL expressions
  const sqlExpressions = collectSqlExpressionsFromSlice(slice);
  if (sqlExpressions.length > 0) {
    const sqlReferencedColumns = findColumnsInSqlExpressions(sqlExpressions, [
      columnName,
    ]);
    return sqlReferencedColumns.has(columnName);
  }

  return false;
}

/**
 * Format a multiplier value as a percentage change string.
 * Example: 1.15 -> "+15%", 0.85 -> "-15%"
 *
 * @param multiplier - The multiplier value (1 = no change)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string with sign
 */
export function formatPercentageChange(
  multiplier: number,
  decimals: number = 0,
): string {
  const percentChange = (multiplier - 1) * 100;
  const sign = percentChange >= 0 ? '+' : '';
  const formatted =
    decimals > 0
      ? percentChange.toFixed(decimals)
      : Math.round(percentChange).toString();
  return `${sign}${formatted}%`;
}
