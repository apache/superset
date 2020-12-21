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
import { QueryFields, QueryFieldAliases, FormDataResidual } from './types/QueryFormData';

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
    percent_metrics: 'metrics',
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
    groupby: [],
    metrics: [],
  };

  Object.entries(formData).forEach(([key, value]) => {
    const normalizedKey = queryFieldAliases[key] || key;
    if (normalizedKey in finalQueryFields) {
      if (normalizedKey === 'metrics') {
        finalQueryFields[normalizedKey] = finalQueryFields[normalizedKey].concat(value);
      } else {
        // currently the groupby and columns field only accept pre-defined columns (string shortcut)
        finalQueryFields[normalizedKey] = finalQueryFields[normalizedKey]
          .concat(value)
          .filter(x => typeof x === 'string' && x);
      }
    }
  });

  if (formData.include_time && !finalQueryFields.groupby.includes(DTTM_ALIAS)) {
    finalQueryFields.groupby.unshift(DTTM_ALIAS);
  }

  return finalQueryFields;
}
