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
  buildQueryContext,
  ensureIsArray,
  QueryFormColumn,
  QueryObject,
  QueryObjectFilterClause,
  SqlaFormData,
} from '@superset-ui/core';
import {
  addJsColumnsToColumns,
  addTooltipColumnsToQuery,
} from '../buildQueryUtils';

export interface DeckGeoJsonFormData extends SqlaFormData {
  geojson?: string;
  filter_nulls?: boolean;
  js_columns?: string[];
  tooltip_contents?: unknown[];
}

export default function buildQuery(formData: DeckGeoJsonFormData) {
  const {
    geojson,
    filter_nulls = true,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!geojson) {
    throw new Error('GeoJSON column is required for GeoJSON charts');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    let columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      geojson,
    ];

    // Add js_columns
    const columnStrings = columns.map(col =>
      typeof col === 'string' ? col : col.label || col.sqlExpression || '',
    );
    const withJsColumns = addJsColumnsToColumns(columnStrings, js_columns);
    columns = withJsColumns as QueryFormColumn[];

    // Add tooltip columns
    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    // Add null filter for geojson column
    const filters: QueryObjectFilterClause[] = ensureIsArray(
      baseQueryObject.filters || [],
    );
    if (filter_nulls) {
      filters.push({ col: geojson, op: 'IS NOT NULL' });
    }

    return [
      {
        ...baseQueryObject,
        columns,
        metrics: [],
        groupby: [],
        filters,
        is_timeseries: false,
      },
    ];
  });
}
