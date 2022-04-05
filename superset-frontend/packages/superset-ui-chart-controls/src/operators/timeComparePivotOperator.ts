/* eslint-disable camelcase */
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
  DTTM_ALIAS,
  ensureIsArray,
  getColumnLabel,
  NumpyFunction,
  PostProcessingPivot,
} from '@superset-ui/core';
import { getMetricOffsetsMap, isValidTimeCompare } from './utils';
import { PostProcessingFactory } from './types';

export const timeComparePivotOperator: PostProcessingFactory<PostProcessingPivot> =
  (formData, queryObject) => {
    const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);

    if (isValidTimeCompare(formData, queryObject)) {
      const aggregates = Object.fromEntries(
        [...metricOffsetMap.values(), ...metricOffsetMap.keys()].map(metric => [
          metric,
          // use the 'mean' aggregates to avoid drop NaN
          { operator: 'mean' as NumpyFunction },
        ]),
      );

      return {
        operation: 'pivot',
        options: {
          index: [formData.x_axis || DTTM_ALIAS],
          columns: ensureIsArray(queryObject.columns).map(getColumnLabel),
          drop_missing_columns: false,
          flatten_columns: false,
          reset_index: false,
          aggregates,
        },
      };
    }

    return undefined;
  };
