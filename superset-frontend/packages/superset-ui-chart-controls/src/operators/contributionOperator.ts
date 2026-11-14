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
  ComparisonType,
  ensureIsArray,
  getMetricLabel,
  PostProcessingContribution,
  QueryFormData,
  QueryObject,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import {
  extractExtraMetrics,
  isTimeComparison,
  TIME_COMPARISON_SEPARATOR,
} from './utils';

/**
 * Labels of the displayed metric columns present when the contribution runs,
 * i.e. every pivoted column except the sort-only "Sort By" metric (see
 * `extractExtraMetrics`). Row contribution divides by the sum of all numeric
 * columns, so the hidden metric must be left out of the calculation.
 */
const getContributionColumns = (
  formData: QueryFormData,
  queryObject: QueryObject,
): string[] | undefined => {
  const metricLabels = ensureIsArray(queryObject.metrics).map(getMetricLabel);
  const hasSortOnlyMetric = extractExtraMetrics(formData).some(
    metric => !metricLabels.includes(getMetricLabel(metric)),
  );
  if (!hasSortOnlyMetric) {
    return undefined;
  }
  if (!isTimeComparison(formData, queryObject)) {
    return metricLabels;
  }
  const offsets = ensureIsArray(formData.time_compare);
  const withOffsets = metricLabels.flatMap(metric =>
    offsets.map(offset => [metric, offset].join(TIME_COMPARISON_SEPARATOR)),
  );
  if (formData.comparison_type === ComparisonType.Values) {
    return [...metricLabels, ...withOffsets];
  }
  // the compare operator drops the originals and adds one derived column per
  // metric and offset, named `<type>__<metric>__<metric>__<offset>`
  return metricLabels.flatMap(metric =>
    offsets.map(offset =>
      [
        formData.comparison_type,
        metric,
        [metric, offset].join(TIME_COMPARISON_SEPARATOR),
      ].join(TIME_COMPARISON_SEPARATOR),
    ),
  );
};

export const contributionOperator: PostProcessingFactory<
  PostProcessingContribution
> = (formData, queryObject, time_shifts) => {
  if (formData.contributionMode) {
    const columns = getContributionColumns(formData, queryObject);
    return {
      operation: 'contribution',
      options: {
        orientation: formData.contributionMode,
        time_shifts,
        ...(columns ? { columns } : {}),
      },
    };
  }
  return undefined;
};
