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
  QueryFormColumn,
  QueryFormOrderBy,
  buildQueryContext,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getXAxisColumn,
} from '@superset-ui/core';
import { rankOperator } from '@superset-ui/chart-controls';
import { HeatmapFormData } from './types';

export default function buildQuery(formData: HeatmapFormData) {
  const { groupby, normalize_across, sort_x_axis, sort_y_axis, x_axis } =
    formData;
  const metric = getMetricLabel(formData.metric);
  const columns = [
    ...ensureIsArray(getXAxisColumn(formData)),
    ...ensureIsArray(groupby),
  ];
  const orderby: QueryFormOrderBy[] = [
    [
      sort_x_axis.includes('value') ? metric : columns[0],
      sort_x_axis.includes('asc'),
    ],
    [
      sort_y_axis.includes('value') ? metric : columns[1],
      sort_y_axis.includes('asc'),
    ],
  ];
  const group_by =
    normalize_across === 'x'
      ? getColumnLabel(x_axis)
      : normalize_across === 'y'
        ? getColumnLabel(groupby as unknown as QueryFormColumn)
        : undefined;
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      orderby,
      post_processing: [
        rankOperator(formData, baseQueryObject, {
          metric,
          group_by,
        }),
      ],
    },
  ]);
}
