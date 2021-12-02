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
import { PostProcessingResample } from '@superset-ui/core';
import { PostProcessingFactory } from './types';
import { TIME_COLUMN } from './utils';

export const resampleOperator: PostProcessingFactory<
  PostProcessingResample | undefined
> = (formData, queryObject) => {
  const resampleZeroFill = formData.resample_method === 'zerofill';
  const resampleMethod = resampleZeroFill ? 'asfreq' : formData.resample_method;
  const resampleRule = formData.resample_rule;
  if (resampleMethod && resampleRule) {
    return {
      operation: 'resample',
      options: {
        method: resampleMethod,
        rule: resampleRule,
        fill_value: resampleZeroFill ? 0 : null,
        time_column: TIME_COLUMN,
      },
    };
  }
  return undefined;
};
