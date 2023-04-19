/*
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

import { hasGenericChartAxes } from '@superset-ui/core';
import buildQueryObject from './buildQueryObject';
import DatasourceKey from './DatasourceKey';
import { QueryFieldAliases, QueryFormData } from './types/QueryFormData';
import { QueryContext, QueryObject } from './types/Query';
import { SetDataMaskHook } from '../chart';
import { JsonObject } from '../connection';
import { normalizeTimeColumn } from './normalizeTimeColumn';
import { isXAxisSet } from './getXAxis';

const WRAP_IN_ARRAY = (baseQueryObject: QueryObject) => [baseQueryObject];

export type BuildFinalQueryObjects = (
  baseQueryObject: QueryObject,
) => QueryObject[];

export default function buildQueryContext(
  formData: QueryFormData,
  options?:
    | {
        buildQuery?: BuildFinalQueryObjects;
        queryFields?: QueryFieldAliases;
        ownState?: JsonObject;
        hooks?: { setDataMask: SetDataMaskHook };
      }
    | BuildFinalQueryObjects,
): QueryContext {
  const { queryFields, buildQuery = WRAP_IN_ARRAY } =
    typeof options === 'function'
      ? { buildQuery: options, queryFields: {} }
      : options || {};
  let queries = buildQuery(buildQueryObject(formData, queryFields));
  // --- query mutator begin ---
  // todo(Yongjie): move the query mutator into buildQueryObject instead of buildQueryContext
  queries.forEach(query => {
    if (Array.isArray(query.post_processing)) {
      // eslint-disable-next-line no-param-reassign
      query.post_processing = query.post_processing.filter(Boolean);
    }
  });
  if (isXAxisSet(formData)) {
    queries = queries.map(query => normalizeTimeColumn(formData, query));
  }

  /* Some charts saved before GENERIC_CHART_AXES is enabled will have the wrong
   * time granularity set. This fixes the generated payload to conform with the new
   * schema used when GENERIC_CHART_AXES is enabled.
   */
  if (hasGenericChartAxes && formData.granularity_sqla) {
    const filterSubject = formData.granularity_sqla;
    const filterComparator = formData?.time_range || 'No Filter';

    queries.forEach(query => {
      if (query.columns) {
        const index = query.columns.indexOf(filterSubject);
        if (index > -1) {
          // eslint-disable-next-line no-param-reassign
          query.columns[index] = {
            columnType: 'BASE_AXIS',
            expressionType: 'SQL',
            label: filterSubject,
            sqlExpression: filterSubject,
            timeGrain: formData.time_grain_sqla,
          };
        }
      }
      // eslint-disable-next-line no-param-reassign
      query.filters = query.filters || [];
      query.filters.push({
        col: filterSubject,
        op: 'TEMPORAL_RANGE',
        val: filterComparator,
      });
    });
  }
  // --- query mutator end ---
  return {
    datasource: new DatasourceKey(formData.datasource).toObject(),
    force: formData.force || false,
    queries,
    form_data: formData,
    result_format: formData.result_format || 'json',
    result_type: formData.result_type || 'full',
  };
}
