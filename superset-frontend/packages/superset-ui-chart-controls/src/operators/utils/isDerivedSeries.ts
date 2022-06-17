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
  ensureIsArray,
  JsonObject,
  QueryFormData,
  ComparisionType,
} from '@superset-ui/core';
import { isString } from 'lodash';

export const isDerivedSeries = (
  series: JsonObject,
  formData: QueryFormData,
): boolean => {
  const comparisonType = formData.comparison_type;
  if (comparisonType !== ComparisionType.Values) {
    return false;
  }

  const timeCompare: string[] = ensureIsArray(formData?.time_compare);
  return isString(series.name)
    ? !!timeCompare.find(timeOffset => series.name.endsWith(timeOffset))
    : false;
};
