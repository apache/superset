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
import {
  buildQueryContext,
  ensureIsArray,
  QueryFormData,
} from '@superset-ui/core';
import { BigNumberYoyMomFormData } from './types';
import { toEnclosedTimeRange } from './timeRange';

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    // Server-side time shifts for the MoM/YoY comparison slots. The backend
    // computes each shifted range and returns the values as extra columns
    // named `<metric label>__<offset>`. A slot that configures a comparison
    // value column reads its value directly from the query result instead.
    // Slots are only sent as time offsets when a time range is actually
    // present ("No filter" would fail the backend's enclosed-range check).
    const formDataYoyMom = formData as BigNumberYoyMomFormData;
    const timeRange = baseQueryObject.time_range;
    const hasTimeRange = !!timeRange && timeRange !== 'No filter';
    const timeOffsets = ensureIsArray([
      hasTimeRange && !formDataYoyMom.comparison1_column
        ? formDataYoyMom.comparison1_offset
        : null,
      hasTimeRange && !formDataYoyMom.comparison2_column
        ? formDataYoyMom.comparison2_offset
        : null,
    ]).filter(Boolean);

    // Comparison value metrics are requested alongside the main metric so the
    // query result carries their columns (useful for custom SQL datasets that
    // pre-aggregate the comparison values).
    const comparisonMetrics = ensureIsArray([
      formDataYoyMom.comparison1_column,
      formDataYoyMom.comparison2_column,
    ]).filter(Boolean);

    // A time comparison requires an enclosed (start and end) time range on
    // the backend. Expand open-ended ranges (e.g. "Previous week") into
    // explicit bounds; ranges the backend resolves on its own are untouched.
    const resolvedTimeRange =
      timeOffsets.length > 0
        ? toEnclosedTimeRange(timeRange)
        : timeRange;

    return [
      {
        ...baseQueryObject,
        metrics: [...ensureIsArray(baseQueryObject.metrics), ...comparisonMetrics],
        time_range: resolvedTimeRange,
        time_offsets: timeOffsets,
      },
    ];
  });
}
