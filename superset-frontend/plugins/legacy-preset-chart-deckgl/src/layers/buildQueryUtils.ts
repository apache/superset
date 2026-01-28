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
  getMetricLabel,
  QueryObjectFilterClause,
  QueryFormColumn,
  getColumnLabel,
} from '@superset-ui/core';

export function addJsColumnsToColumns(
  columns: string[],
  jsColumns?: string[],
  existingColumns?: string[],
): string[] {
  if (!jsColumns?.length) return columns;

  const allExisting = new Set([...columns, ...(existingColumns || [])]);
  const result = [...columns];

  jsColumns.forEach(col => {
    if (!allExisting.has(col)) {
      result.push(col);
      allExisting.add(col);
    }
  });

  return result;
}

export function addNullFilters(
  filters: QueryObjectFilterClause[],
  columnNames: string[],
): QueryObjectFilterClause[] {
  const existingFilters = new Set(
    filters
      .filter(filter => filter.op === 'IS NOT NULL')
      .map(filter => filter.col),
  );

  const nullFilters: QueryObjectFilterClause[] = columnNames
    .filter(col => !existingFilters.has(col))
    .map(col => ({
      col,
      op: 'IS NOT NULL' as const,
    }));

  return [...filters, ...nullFilters];
}

export function addMetricNullFilter(
  filters: QueryObjectFilterClause[],
  metric?: string,
): QueryObjectFilterClause[] {
  if (!metric) return filters;
  return addNullFilters(filters, [getMetricLabel(metric)]);
}

export function ensureColumnsUnique(columns: string[]): string[] {
  return [...new Set(columns)];
}

export function addColumnsIfNotExists(
  baseColumns: string[],
  newColumns: string[],
): string[] {
  const existing = new Set(baseColumns);
  const result = [...baseColumns];

  newColumns.forEach(col => {
    if (!existing.has(col)) {
      result.push(col);
      existing.add(col);
    }
  });

  return result;
}

export function processMetricsArray(metrics: (string | undefined)[]): string[] {
  return metrics.filter((metric): metric is string => Boolean(metric));
}

export function extractTooltipColumns(tooltipContents?: unknown[]): string[] {
  if (!Array.isArray(tooltipContents) || !tooltipContents.length) {
    return [];
  }

  const columns: string[] = [];

  tooltipContents.forEach(item => {
    if (typeof item === 'string') {
      columns.push(item);
    } else if (item && typeof item === 'object') {
      const objItem = item as Record<string, unknown>;
      if (
        objItem.item_type === 'column' &&
        typeof objItem.column_name === 'string'
      ) {
        columns.push(objItem.column_name);
      }
    }
  });

  return columns;
}

export function addTooltipColumnsToQuery(
  baseColumns: QueryFormColumn[],
  tooltipContents?: unknown[],
): QueryFormColumn[] {
  const tooltipColumns = extractTooltipColumns(tooltipContents);

  const baseColumnLabels = baseColumns.map(getColumnLabel);
  const existingLabels = new Set(baseColumnLabels);

  const result: QueryFormColumn[] = [...baseColumns];

  tooltipColumns.forEach(col => {
    if (!existingLabels.has(col)) {
      result.push(col);
      existingLabels.add(col);
    }
  });

  return result;
}
