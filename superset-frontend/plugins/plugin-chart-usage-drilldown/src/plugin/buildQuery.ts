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
  getColumnLabel,
  QueryFormColumn,
} from '@superset-ui/core';
import { UsageDrilldownFormData } from '../types';
import { durationMetrics } from '../consts';
import { alwaysOneRow } from '../alwaysOneRow';

// One flat query at the deepest level; the component aggregates upwards
// client-side as the user drills, so no extra round trips per click.
export default function buildQuery(formData: UsageDrilldownFormData) {
  const {
    groupby = [],
    metric,
    link_column,
    badge_column,
    subtitle_columns = [],
    duration_column,
  } = formData;
  const extraColumns = [link_column, badge_column, ...subtitle_columns].filter(
    (column): column is QueryFormColumn =>
      column !== null && column !== undefined,
  );

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: [...groupby, ...extraColumns],
      metrics: [
        metric,
        ...(duration_column
          ? durationMetrics(getColumnLabel(duration_column))
          : []),
      ],
      orderby: [[metric, false]],
    },
    alwaysOneRow(baseQueryObject, metric),
  ]);
}
