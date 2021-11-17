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
import { ComparisionType } from '@superset-ui/core';
import { getMetricOffsetsMap } from './getMetricOffsetsMap';
import { PostProcessingFactory } from '../types';

export const isValidTimeCompare: PostProcessingFactory<boolean> = (
  formData,
  queryObject,
) => {
  const comparisonType = formData.comparison_type;
  const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);

  return (
    Object.values(ComparisionType).includes(comparisonType) &&
    metricOffsetMap.size > 0
  );
};
