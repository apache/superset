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
import { isEmpty } from 'lodash';
import {
  ensureIsArray,
  getMetricLabel,
  getXAxisLabel,
  hasGenericChartAxes,
  isDefined,
  PostProcessingSort,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { extractExtraMetrics } from './utils';

export const sortOperator: PostProcessingFactory<PostProcessingSort> = (
  formData,
  queryObject,
) => {
  // the sortOperator only used in the barchart v2
  const sortableLabels = [
    getXAxisLabel(formData),
    ...ensureIsArray(formData.metrics).map(getMetricLabel),
    ...extractExtraMetrics(formData).map(getMetricLabel),
  ].filter(Boolean);

  if (
    hasGenericChartAxes &&
    isDefined(formData?.x_axis_sort) &&
    isDefined(formData?.x_axis_sort_asc) &&
    sortableLabels.includes(formData.x_axis_sort) &&
    // the sort operator doesn't support sort-by multiple series.
    isEmpty(formData.groupby)
  ) {
    if (formData.x_axis_sort === getXAxisLabel(formData)) {
      return {
        operation: 'sort',
        options: {
          is_sort_index: true,
          ascending: formData.x_axis_sort_asc,
        },
      };
    }

    return {
      operation: 'sort',
      options: {
        by: formData.x_axis_sort,
        ascending: formData.x_axis_sort_asc,
      },
    };
  }
  return undefined;
};
