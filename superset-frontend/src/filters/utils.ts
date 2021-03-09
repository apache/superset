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
import { QueryObjectFilterClause } from '@superset-ui/core';

export const getSelectExtraFormData = (
  col: string,
  value?: null | (string | number)[],
  emptyFilter = false,
  inverseSelection = false,
) => ({
  append_form_data: emptyFilter
    ? {
        adhoc_filters: [
          {
            expressionType: 'SQL',
            clause: 'WHERE',
            sqlExpression: '1 = 0',
          },
        ],
      }
    : {
        filters:
          value === undefined || value === null || value.length === 0
            ? []
            : [
                {
                  col,
                  op: inverseSelection ? ('NOT IN' as const) : ('IN' as const),
                  val: value,
                },
              ],
      },
});

export const getRangeExtraFormData = (
  col: string,
  lower?: number | null,
  upper?: number | null,
) => {
  const filters: QueryObjectFilterClause[] = [];
  if (lower !== undefined && lower !== null) {
    filters.push({ col, op: '>=', val: lower });
  }
  if (upper !== undefined && upper !== null) {
    filters.push({ col, op: '<=', val: upper });
  }

  return {
    append_form_data: {
      filters,
    },
  };
};
