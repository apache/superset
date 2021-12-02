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
 * specific language governing permissions and limitationsxw
 * under the License.
 */
import {
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  PostProcessingPivot,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { TIME_COLUMN, isValidTimeCompare } from './utils';
import { timeComparePivotOperator } from './timeComparePivotOperator';

export const pivotOperator: PostProcessingFactory<
  PostProcessingPivot | undefined
> = (formData, queryObject) => {
  const metricLabels = ensureIsArray(queryObject.metrics).map(getMetricLabel);
  if (queryObject.is_timeseries && metricLabels.length) {
    if (isValidTimeCompare(formData, queryObject)) {
      return timeComparePivotOperator(formData, queryObject);
    }

    return {
      operation: 'pivot',
      options: {
        index: [TIME_COLUMN],
        columns: ensureIsArray(queryObject.columns).map(getColumnLabel),
        // Create 'dummy' mean aggregates to assign cell values in pivot table
        // use the 'mean' aggregates to avoid drop NaN. PR: https://github.com/apache-superset/superset-ui/pull/1231
        aggregates: Object.fromEntries(
          metricLabels.map(metric => [metric, { operator: 'mean' }]),
        ),
        drop_missing_columns: false,
      },
    };
  }

  return undefined;
};
