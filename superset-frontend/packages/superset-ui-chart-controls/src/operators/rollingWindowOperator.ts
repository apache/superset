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
  ensureIsArray,
  ensureIsInt,
  PostProcessingCum,
  PostProcessingRolling,
  RollingType,
} from '@superset-ui/core';
import { getMetricOffsetsMap, isTimeComparison } from './utils';
import { PostProcessingFactory } from './types';

export const rollingWindowOperator: PostProcessingFactory<
  PostProcessingRolling | PostProcessingCum
> = (formData, queryObject) => {
  let columns: (string | undefined)[];
  if (isTimeComparison(formData, queryObject)) {
    const metricsMap = getMetricOffsetsMap(formData, queryObject);
    columns = [
      ...Array.from(metricsMap.values()),
      ...Array.from(metricsMap.keys()),
    ];
  } else {
    columns = ensureIsArray(queryObject.metrics).map(metric => {
      if (typeof metric === 'string') {
        return metric;
      }
      return metric.label;
    });
  }
  const columnsMap = Object.fromEntries(columns.map(col => [col, col]));

  if (formData.rolling_type === RollingType.Cumsum) {
    return {
      operation: 'cum',
      options: {
        operator: 'sum',
        columns: columnsMap,
      },
    };
  }

  if (
    [RollingType.Sum, RollingType.Mean, RollingType.Std].includes(
      formData.rolling_type,
    )
  ) {
    return {
      operation: 'rolling',
      options: {
        rolling_type: formData.rolling_type,
        window: ensureIsInt(formData.rolling_periods, 1),
        min_periods: ensureIsInt(formData.min_periods, 0),
        columns: columnsMap,
      },
    };
  }

  return undefined;
};
