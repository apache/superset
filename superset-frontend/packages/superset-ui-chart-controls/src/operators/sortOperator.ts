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
  getXAxisLabel,
  hasGenericChartAxes,
  PostProcessingSort,
  UnsortedXAxis,
  isAxisSortValue,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const sortOperator: PostProcessingFactory<PostProcessingSort> = (
  formData,
  queryObject,
) => {
  if (
    hasGenericChartAxes &&
    isAxisSortValue(formData?.x_axis_sort) &&
    formData.x_axis_sort.sortByLabel !== UnsortedXAxis &&
    // the sort operator doesn't support sort-by multiple series.
    isEmpty(formData.groupby)
  ) {
    if (formData.x_axis_sort.sortByLabel === getXAxisLabel(formData)) {
      return {
        operation: 'sort',
        options: {
          is_sort_index: true,
          ascending: formData.x_axis_sort.isAsc,
        },
      };
    }

    return {
      operation: 'sort',
      options: {
        by: formData.x_axis_sort.sortByLabel,
        ascending: formData.x_axis_sort.isAsc,
      },
    };
  }
  return undefined;
};
