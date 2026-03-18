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
  ComparisonType,
  getXAxisLabel,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { getMetricOffsetsMap, isTimeComparison } from './utils';
import { TIME_COMPARISON_SEPARATOR } from './utils/constants';

export const renameOperator: PostProcessingFactory<PostProcessingRename> = (
  formData,
  queryObject,
) => {
  const metrics = ensureIsArray(queryObject.metrics);
  const columns = ensureIsArray(
    queryObject.series_columns || queryObject.columns,
  );
  const timeOffsets = ensureIsArray(formData.time_compare);
  const { truncate_metric } = formData;
  const xAxisLabel = getXAxisLabel(formData);
  const isTimeComparisonValue = isTimeComparison(formData, queryObject);

  // remove or rename top level of column name(metric name) in the MultiIndex when
  // 1) at least 1 metric
  // 2) xAxis exist
  // 3a) isTimeComparisonValue
  // 3b-1) dimension exist or multiple time shift metrics exist
  // 3b-2) truncate_metric in form_data and truncate_metric is true
  if (
    metrics.length > 0 &&
    xAxisLabel &&
    (isTimeComparisonValue ||
      ((columns.length > 0 || timeOffsets.length > 1) &&
        truncate_metric !== undefined &&
        !!truncate_metric))
  ) {
    const renamePairs: [string, string | null][] = [];
    if (
      // "actual values" will add derived metric.
      // we will rename the "metric" from the metricWithOffset label
      // for example: "count__1 year ago" =>	"1 year ago"
      isTimeComparisonValue
    ) {
      const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);
      const timeOffsets = ensureIsArray(formData.time_compare);
      [...metricOffsetMap.entries()].forEach(
        ([metricWithOffset, metricOnly]) => {
          const offsetLabel = timeOffsets.find(offset =>
            metricWithOffset.includes(offset),
          );
          renamePairs.push([
            formData.comparison_type === ComparisonType.Values
              ? metricWithOffset
              : [formData.comparison_type, metricOnly, metricWithOffset].join(
                  TIME_COMPARISON_SEPARATOR,
                ),
            metrics.length > 1 ? `${metricOnly}, ${offsetLabel}` : offsetLabel,
          ]);
        },
      );
    }

    if (
      ![
        ComparisonType.Difference,
        ComparisonType.Percentage,
        ComparisonType.Ratio,
      ].includes(formData.comparison_type) &&
      metrics.length === 1 &&
      renamePairs.length === 0
    ) {
      renamePairs.push([getMetricLabel(metrics[0]), null]);
    }

    if (renamePairs.length === 0) {
      return undefined;
    }

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
