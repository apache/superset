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
 * specific language governing permissions and limitations
 * under the License.
 */
import { QueryObject, QueryObjectExtras, SqlaFormData } from './types';

const ALLOWED_OVERRIDES: Record<keyof SqlaFormData, keyof QueryObject> = {
  granularity: 'granularity',
  granularity_sqla: 'granularity',
  time_column: 'time_column',
  time_grain: 'time_grain',
  time_range: 'time_range',
};
const ALLOWED_EXTRAS_OVERRIDES: (keyof QueryObjectExtras)[] = [
  'druid_time_origin',
  'relative_start',
  'relative_end',
  'time_grain_sqla',
  'time_range_endpoints',
];

export function overrideExtraFormData(
  queryObject: QueryObject,
  overrideFormData: Partial<QueryObject>,
): QueryObject {
  const overriddenFormData: QueryObject = { ...queryObject };
  const { extras: overriddenExtras = {} } = overriddenFormData;
  Object.entries(ALLOWED_OVERRIDES).forEach(([key, target]) => {
    if (key in overrideFormData) {
      overriddenFormData[target] = overrideFormData[key];
    }
  });
  const { extras: overrideExtras = {} } = overrideFormData;
  ALLOWED_EXTRAS_OVERRIDES.forEach(key => {
    if (key in overrideExtras) {
      // @ts-ignore
      overriddenExtras[key] = overrideExtras[key];
    }
  });
  if (Object.keys(overriddenExtras).length > 0) {
    overriddenFormData.extras = overriddenExtras;
  }
  return overriddenFormData;
}
