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
import { DTTM_ALIAS } from './buildQueryObject';
import { QueryFields, QueryFieldAliases, FormDataResidual, QueryMode } from './types/QueryFormData';

/**
 * Extra SQL query related fields from chart form data.
 * Consolidate field values into arrays.
 *
 * @param formData - the (partial) form data obtained from chart controls.
 * @param aliases - additional field aliases that maps arbitrary field names to
 *                  query field names.
 */
export default function extractQueryFields(
  formData: FormDataResidual,
  aliases?: QueryFieldAliases,
): QueryFields {
  const queryFieldAliases: QueryFieldAliases = {
    /** These are predefined for backward compatibility */
    metric: 'metrics',
    metric_2: 'metrics',
    secondary_metric: 'metrics',
    x: 'metrics',
    y: 'metrics',
    size: 'metrics',
    all_columns: 'columns',
    series: 'groupby',
    ...aliases,
  };
  const finalQueryFields: QueryFields = {
    columns: [],
    metrics: [],
  };
  const { query_mode: queryMode, include_time: includeTime, ...restFormData } = formData;

  Object.entries(restFormData).forEach(([key, value]) => {
    // ignore `null` or `undefined` value
    if (value == null) {
      return;
    }

    let normalizedKey: string = queryFieldAliases[key] || key;

    // ignore groupby and metrics when in raw records mode
    if (
      queryMode === QueryMode.raw &&
      (normalizedKey === 'groupby' || normalizedKey === 'metrics')
    ) {
      return;
    }
    // ignore columns when (specifically) in aggregate mode.
    if (queryMode === QueryMode.aggregate && normalizedKey === 'columns') {
      return;
    }
    // groupby has been deprecated: https://github.com/apache/superset/pull/9366
    if (normalizedKey === 'groupby') {
      normalizedKey = 'columns';
    }
    if (normalizedKey === 'metrics') {
      finalQueryFields[normalizedKey] = finalQueryFields[normalizedKey].concat(value);
    } else if (normalizedKey === 'columns') {
      // currently the columns field only accept pre-defined columns (string shortcut)
      finalQueryFields[normalizedKey] = finalQueryFields[normalizedKey]
        .concat(value)
        .filter(x => typeof x === 'string' && x);
    }
  });

  if (includeTime && !finalQueryFields.columns.includes(DTTM_ALIAS)) {
    finalQueryFields.columns.unshift(DTTM_ALIAS);
  }

  return finalQueryFields;
}
