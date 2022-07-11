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
  PostProcessingRename,
  ensureIsArray,
  getMetricLabel,
  ComparisionType,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { getMetricOffsetsMap, isTimeComparison } from './utils';

export const renameOperator: PostProcessingFactory<PostProcessingRename> = (
  formData,
  queryObject,
) => {
  const metrics = ensureIsArray(queryObject.metrics);
  const columns = ensureIsArray(queryObject.columns);
  const { x_axis: xAxis, truncate_metric } = formData;
  // remove or rename top level of column name(metric name) in the MultiIndex when
  // 1) only 1 metric
  // 2) exist dimentsion
  // 3) exist xAxis
  // 4) exist time comparison, and comparison type is "actual values"
  // 5) truncate_metric in form_data and truncate_metric is true
  if (
    metrics.length === 1 &&
    columns.length > 0 &&
    (xAxis || queryObject.is_timeseries) &&
    !(
      // todo: we should provide an approach to handle derived metrics
      (
        isTimeComparison(formData, queryObject) &&
        [
          ComparisionType.Difference,
          ComparisionType.Ratio,
          ComparisionType.Percentage,
        ].includes(formData.comparison_type)
      )
    ) &&
    truncate_metric !== undefined &&
    !!truncate_metric
  ) {
    const renamePairs: [string, string | null][] = [];

    if (
      // "actual values" will add derived metric.
      // we will rename the "metric" from the metricWithOffset label
      // for example: "count__1 year ago" =>	"1 year ago"
      isTimeComparison(formData, queryObject) &&
      formData.comparison_type === ComparisionType.Values
    ) {
      const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);
      const timeOffsets = ensureIsArray(formData.time_compare);
      [...metricOffsetMap.keys()].forEach(metricWithOffset => {
        const offsetLabel = timeOffsets.find(offset =>
          metricWithOffset.includes(offset),
        );
        renamePairs.push([metricWithOffset, offsetLabel]);
      });
    }

    renamePairs.push([getMetricLabel(metrics[0]), null]);

    return {
      operation: 'rename',
      options: {
        columns: Object.fromEntries(renamePairs),
        level: 0,
        inplace: true,
      },
    };
  }

  return undefined;
};
