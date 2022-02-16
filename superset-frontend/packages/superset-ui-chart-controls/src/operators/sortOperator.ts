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
import { DTTM_ALIAS, PostProcessingSort, RollingType } from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const sortOperator: PostProcessingFactory<
  PostProcessingSort | undefined
> = (formData, queryObject) => {
  const { x_axis: xAxis } = formData;
  if (
    (xAxis || queryObject.is_timeseries) &&
    Object.values(RollingType).includes(formData.rolling_type)
  ) {
    const index = xAxis || DTTM_ALIAS;
    return {
      operation: 'sort',
      options: {
        columns: {
          [index]: true,
        },
      },
    };
  }
  return undefined;
};
