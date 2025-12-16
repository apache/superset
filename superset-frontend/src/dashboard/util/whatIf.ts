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
import { ensureIsArray, getColumnLabel } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import {
  ChartsState,
  DatasourcesState,
  ChartQueryPayload,
  WhatIfColumn,
} from '../types';

/**
 * Check if a column is numeric based on its type_generic field
 */
export function isNumericColumn(column: ColumnMeta): boolean {
  return column.type_generic === GenericDataType.Numeric;
}

/**
 * Extract column names from a chart's form_data
 * This includes columns from groupby, metrics, x_axis, series, filters, etc.
 */
export function extractColumnsFromChart(chart: ChartQueryPayload): Set<string> {
  const columns = new Set<string>();
  const formData = chart.form_data;
  if (!formData) return columns;

  // Helper to add column - handles both physical columns (strings) and adhoc columns
  const addColumn = (col: any) => {
    if (col) {
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
  ensureIsArray(formData.metrics).forEach((metric: any) => {
    if (typeof metric === 'string') {
      // Saved metric name - we can't extract columns from it
      return;
    }
    if (metric && typeof metric === 'object' && 'column' in metric) {
      const metricColumn = metric.column;
      if (typeof metricColumn === 'string') {
        columns.add(metricColumn);
      } else if (metricColumn?.column_name) {
        columns.add(metricColumn.column_name);
      }
    }
  });

  // Extract metric (singular) - used by pie charts and other single-metric charts
  if (formData.metric && typeof formData.metric === 'object') {
    const metric = formData.metric as any;
    if ('column' in metric) {
      const metricColumn = metric.column;
      if (typeof metricColumn === 'string') {
        columns.add(metricColumn);
      } else if (metricColumn?.column_name) {
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
  ensureIsArray(formData.adhoc_filters).forEach((filter: any) => {
    if (filter?.subject && typeof filter.subject === 'string') {
      columns.add(filter.subject);
    }
  });

  // Extract columns array (used by some chart types like box_plot)
  ensureIsArray(formData.columns).forEach(addColumn);

  return columns;
}

/**
 * Get the datasource key from a chart's form_data
 * Format: "datasourceId__datasourceType" e.g., "2__table"
 */
export function getDatasourceKey(chart: ChartQueryPayload): string | null {
  const datasource = chart.form_data?.datasource;
  if (!datasource || typeof datasource !== 'string') return null;
  return datasource;
}

/**
 * Get numeric columns used by charts on a dashboard
 * Returns columns grouped by their usage across charts
 */
export function getNumericColumnsForDashboard(
  charts: ChartsState,
  datasources: DatasourcesState,
): WhatIfColumn[] {
  const columnMap = new Map<string, WhatIfColumn>();

  Object.values(charts).forEach(chart => {
    const chartId = chart.id;
    // Chart and ChartQueryPayload both have id and form_data, so we can safely access them
    const chartPayload = { id: chart.id, form_data: chart.form_data };
    const datasourceKey = getDatasourceKey(chartPayload);
    if (!datasourceKey) return;

    const datasource = datasources[datasourceKey];
    if (!datasource?.columns) return;

    // Extract columns referenced by this chart
    const referencedColumns = extractColumnsFromChart(chartPayload);

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
 * Check if a chart uses a specific column
 */
export function chartUsesColumn(
  chart: ChartQueryPayload,
  columnName: string,
): boolean {
  const columns = extractColumnsFromChart(chart);
  return columns.has(columnName);
}
