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
  getMetricLabel,
  ensureIsArray,
  PostProcessingAggregation,
  QueryFormData,
  Aggregates,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const aggregationOperator: PostProcessingFactory<
  PostProcessingAggregation
> = (formData: QueryFormData, queryObject) => {
  const { aggregation = 'LAST_VALUE' } = formData;

  if (aggregation === 'LAST_VALUE' || aggregation === 'raw') {
    return undefined;
  }

  const metrics = ensureIsArray(queryObject.metrics);
  if (metrics.length === 0) {
    return undefined;
  }

  const aggregates: Aggregates = {};
  metrics.forEach(metric => {
    const metricLabel = getMetricLabel(metric);
    aggregates[metricLabel] = {
      operator: aggregation,
      column: metricLabel,
    };
  });

  return {
    operation: 'aggregate',
    options: {
      groupby: [],
      aggregates,
    },
  };
};
