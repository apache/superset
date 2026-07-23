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
  QueryObject,
  QueryObjectFilterClause,
  BuildQuery,
} from '@superset-ui/core';
import { DEFAULT_FORM_DATA, PluginFilterCustomDateFilterQueryFormData } from './types';

const buildQuery: BuildQuery<PluginFilterCustomDateFilterQueryFormData> = (
  formData: PluginFilterCustomDateFilterQueryFormData,
  _options,
) => {
  const { dateRange, granularitySqla } = { ...DEFAULT_FORM_DATA, ...formData };
  return buildQueryContext(formData, baseQueryObject => {
    const { filters = [] } = baseQueryObject;
    const extraFilters: QueryObjectFilterClause[] = [];

    if (dateRange && dateRange.length === 2 && granularitySqla) {
      extraFilters.push({
        col: granularitySqla,
        op: '>=',
        val: dateRange[0],
      });
      extraFilters.push({
        col: granularitySqla,
        op: '<=',
        val: dateRange[1],
      });
    }

    const query: QueryObject[] = [
      {
        ...baseQueryObject,
        filters: filters.concat(extraFilters),
      },
    ];
    return query;
  });
};

export default buildQuery;
