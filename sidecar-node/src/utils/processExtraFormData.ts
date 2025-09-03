// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { QueryObject, ExtraFormDataOverride } from '../types';

/**
 * Override extra form data used by native and cross filters
 */
export function overrideExtraFormData(
  queryObject: QueryObject,
  overrides: ExtraFormDataOverride,
): QueryObject {
  const result = { ...queryObject };

  // Override top-level properties
  if (overrides.time_range !== undefined) {
    result.time_range = overrides.time_range;
  }
  if (overrides.granularity !== undefined) {
    result.granularity = overrides.granularity;
  }
  if (overrides.granularity_sqla !== undefined) {
    result.granularity = overrides.granularity_sqla;
  }

  // Override extras properties
  if (result.extras) {
    if (overrides.relative_start !== undefined) {
      result.extras.relative_start = overrides.relative_start;
    }
    if (overrides.relative_end !== undefined) {
      result.extras.relative_end = overrides.relative_end;
    }
    if (overrides.time_grain_sqla !== undefined) {
      result.extras.time_grain_sqla = overrides.time_grain_sqla;
    }
    if (overrides.time_compare !== undefined) {
      result.extras.time_compare = overrides.time_compare;
    }
  }

  return result;
}