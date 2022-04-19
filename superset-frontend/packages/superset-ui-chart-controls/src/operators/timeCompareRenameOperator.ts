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
  ComparisionType,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { getMetricOffsetsMap, isValidTimeCompare } from './utils';

export const timeCompareRenameOperator: PostProcessingFactory<PostProcessingRename> =
  (formData, queryObject) => {
    const metrics = ensureIsArray(queryObject.metrics);
    if (
      metrics.length === 1 &&
      // "actual values" will add derived metric.
      isValidTimeCompare(formData, queryObject) &&
      formData.comparison_type === ComparisionType.Values
    ) {
      const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);
      const timeOffsets = ensureIsArray(formData.time_compare);
      const renamePairs = [...metricOffsetMap.keys()].map(metricWithOffset => [
        metricWithOffset,
        timeOffsets.find(offset => metricWithOffset.includes(offset)),
      ]);

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
