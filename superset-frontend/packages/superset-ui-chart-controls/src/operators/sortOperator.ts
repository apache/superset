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
  getColumnLabel,
  getMetricLabel,
  PostProcessingSort,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const sortOperator: PostProcessingFactory<PostProcessingSort> = (
  formData,
  queryObject,
) => {
  const { columns, metrics, timeseries_limit_metric, order_desc } = queryObject;
  const metricLabels = ensureIsArray(metrics).map(getMetricLabel);
  const columnLabels = ensureIsArray(columns).map(getColumnLabel);
  const column: string[] = ensureIsArray(timeseries_limit_metric).map(
    getMetricLabel,
  );
  if (metricLabels.includes(column[0]) || columnLabels.includes(column[0])) {
    return {
      operation: 'sort',
      options: {
        columns: {
          [column[0]]: !order_desc,
        },
      },
    };
  }
  return undefined;
};
