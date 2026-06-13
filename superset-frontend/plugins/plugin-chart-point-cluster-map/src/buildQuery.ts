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

export interface MapLibreFormData extends SqlaFormData {
  all_columns_x?: string;
  all_columns_y?: string;
  map_label?: string[];
  point_radius?: string;
  clustering_radius?: string;
  pandas_aggfunc?: string;
  global_opacity?: number;
  maplibre_style?: string;
  mapbox_style?: string;
  map_color?: string;
  render_while_dragging?: boolean;
  point_radius_unit?: string;
}

export default function buildQuery(formData: MapLibreFormData) {
  const { all_columns_x, all_columns_y, map_label, point_radius } = formData;

  if (!all_columns_x || !all_columns_y) {
    throw new Error('Longitude and latitude columns are required');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    const columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      all_columns_x,
      all_columns_y,
    ];

    // Add label column if specified and not 'count'
    const hasCustomMetric =
      map_label && map_label.length > 0 && map_label[0] !== 'count';
    if (hasCustomMetric) {
      columns.push(map_label[0]);
    }

    // Add point radius column if not "Auto"
    if (point_radius && point_radius !== 'Auto') {
      columns.push(point_radius);
    }

    // Add null filters for lon/lat
    const filters: QueryObjectFilterClause[] = ensureIsArray(
      baseQueryObject.filters || [],
    );
    filters.push(
      { col: all_columns_x, op: 'IS NOT NULL' },
      { col: all_columns_y, op: 'IS NOT NULL' },
    );

    // Deduplicate columns
    const uniqueColumns = [...new Set(columns)];

    return [
      {
        ...baseQueryObject,
        columns: uniqueColumns,
        filters,
        is_timeseries: false,
      },
    ];
  });
}
