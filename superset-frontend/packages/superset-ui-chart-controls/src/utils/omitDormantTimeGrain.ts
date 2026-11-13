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
  QueryObject,
  TimeGranularity,
} from '@superset-ui/core';

// Only recognized duration choices are safe to treat as dormant. Legacy date
// formats and anchored week intervals are not semantic-layer durations.
const DURATION_GRAINS = new Set<string>(
  Object.values(TimeGranularity).filter(
    grain => grain.startsWith('P') && !grain.includes('/'),
  ),
);

/** Omit a dormant duration only when every selected column is proven non-temporal. */
export function omitDormantTimeGrain(
  query: QueryObject,
  temporalColumns: Record<string, boolean> | undefined,
): QueryObject {
  const grain = query.extras?.time_grain_sqla;
  if (
    typeof grain !== 'string' ||
    !DURATION_GRAINS.has(grain) ||
    query.granularity ||
    query.is_timeseries ||
    !Array.isArray(query.columns) ||
    !query.columns.every(
      column => isPhysicalColumn(column) && temporalColumns?.[column] === false,
    )
  ) {
    return query;
  }
  const extras = { ...query.extras };
  delete extras.time_grain_sqla;
  return { ...query, extras };
}
