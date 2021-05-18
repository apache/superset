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
  AdhocFilter,
  buildQueryContext,
  GenericDataType,
  QueryObject,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { DEFAULT_FORM_DATA, PluginFilterSelectQueryFormData } from './types';

export default function buildQuery(
  formData: PluginFilterSelectQueryFormData,
  options,
) {
  const {
    ownState: { search, coltypeMap },
  } = options;
  const { sortAscending, sortMetric } = { ...DEFAULT_FORM_DATA, ...formData };
  return buildQueryContext(formData, baseQueryObject => {
    const { columns = [], filters = [] } = baseQueryObject;
    // @ts-ignore
    const extra_filters: QueryObjectFilterClause[] = search
      ? columns.map(column => {
          if (
            coltypeMap[column] === GenericDataType.NUMERIC &&
            !Number.isNaN(Number(search))
          ) {
            // for numeric columns we apply a >= where clause
            return {
              col: column,
              op: '>=',
              val: Number(search),
            };
          }
          return {
            col: column,
            op: 'LIKE',
            val: `%${search}%`,
          };
        })
      : [];

    const sortColumns = sortMetric ? [sortMetric] : columns;
    const query: QueryObject[] = [
      {
        ...baseQueryObject,
        apply_fetch_values_predicate: true,
        groupby: columns,
        metrics: sortMetric ? [sortMetric] : [],
        filters: filters
          .concat(columns.map(column => ({ col: column, op: 'IS NOT NULL' })))
          .concat(extra_filters),
        orderby:
          sortMetric || sortAscending
            ? sortColumns.map(column => [column, sortAscending])
            : [],
      },
    ];
    return query;
  });
}
