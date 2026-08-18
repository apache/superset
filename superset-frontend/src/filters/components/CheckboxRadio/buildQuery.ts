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
import { buildQueryContext, BuildQuery, QueryObject } from '@superset-ui/core';
import { PluginFilterCheckboxRadioQueryFormData } from './types';

// Default row limit for populating discrete control options (e.g. Radio, Checkbox)
const DEFAULT_ROW_LIMIT = 1000;

const buildQuery: BuildQuery<PluginFilterCheckboxRadioQueryFormData> = (
  formData: PluginFilterCheckboxRadioQueryFormData,
) =>
  buildQueryContext(formData, baseQueryObject => {
    const rawCol =
      formData.targets?.[0]?.column?.name ||
      (formData as Record<string, unknown>).groupby ||
      formData.filterColumn;
    const col = Array.isArray(rawCol)
      ? rawCol[0]
      : typeof rawCol === 'object' && rawCol !== null
        ? (
            rawCol as {
              label?: string;
              column_name?: string;
              sqlExpression?: string;
            }
          ).column_name ||
          (rawCol as { label?: string }).label ||
          (rawCol as { sqlExpression?: string }).sqlExpression
        : rawCol;
    const columns = col ? [String(col)] : baseQueryObject.columns || [];

    const query: QueryObject[] = [
      {
        ...baseQueryObject,
        columns,
        orderby: columns.map(c => [c, true]),
        row_limit:
          typeof formData.row_limit === 'number'
            ? formData.row_limit
            : DEFAULT_ROW_LIMIT,
      },
    ];
    return query;
  });

export default buildQuery;
