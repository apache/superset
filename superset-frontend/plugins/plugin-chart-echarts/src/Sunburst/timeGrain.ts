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
  isPhysicalColumn,
  QueryFormColumn,
  TimeGranularity,
} from '@superset-ui/core';
import type { EchartsSunburstFormData } from './types';

/** Grain temporal hierarchy levels, with a legacy Time Column fallback. */
export function isGrainedLevel(
  column: QueryFormColumn,
  temporalColumnsLookup: Record<string, boolean> | undefined,
  granularitySqla: string | undefined,
): boolean {
  return (
    isPhysicalColumn(column) &&
    (granularitySqla === column || !!temporalColumnsLookup?.[column])
  );
}

/** Resolve the same saved/dashboard grain and subject used by buildQuery. */
export function getSunburstTimeGrain(
  formData: EchartsSunburstFormData,
  column: QueryFormColumn,
): TimeGranularity | undefined {
  return isGrainedLevel(
    column,
    formData.temporalColumnsLookup,
    formData.extraFormData?.granularity_sqla ?? formData.granularitySqla,
  )
    ? (formData.extraFormData?.time_grain_sqla ?? formData.timeGrainSqla)
    : undefined;
}
