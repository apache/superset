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
  fetchTimeRanges,
  type Level,
  type ResolvedTimeRange,
  type TimeRangeRequestOptions,
} from '@superset-ui/core';
import type { Dayjs } from '@superset-ui/core/utils/dates';
import {
  allFailures,
  type EffectiveLimits,
  hasLimits,
  type LimitFailure,
  limitsFor,
  NO_LIMITS,
  parseServerDate,
} from './rules';

export type LimitCheck = { timeRange: string; seeded?: boolean } & (
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | {
      status: 'checked';
      range: ResolvedTimeRange;
      limits: EffectiveLimits;
      today: Dayjs;
      failures: LimitFailure[];
    }
);

/** A limits check fails fast instead of holding the picker or the chart. */
export const LIMIT_REQUEST_OPTIONS: TimeRangeRequestOptions = {
  timeout: 10000,
  fetchRetryOptions: { retries: 0 },
};

export async function checkTimeRange(
  timeRange: string,
  levels: Level[],
): Promise<LimitCheck> {
  const result = await fetchTimeRanges(
    timeRange,
    [],
    hasLimits(levels) ? LIMIT_REQUEST_OPTIONS : undefined,
  );
  if ('error' in result) {
    return result.timedOut || (result.status ?? 0) >= 500
      ? { timeRange, status: 'unavailable' }
      : { timeRange, status: 'error', message: result.error };
  }
  const today = parseServerDate(result.today);
  const limits = limitsFor(levels, today, parseServerDate(result.now));
  if (!today || (limits && 'unavailable' in limits)) {
    return { timeRange, status: 'unavailable' };
  }
  const effective = limits ?? NO_LIMITS;
  return {
    timeRange,
    status: 'checked',
    range: result.range,
    limits: effective,
    today,
    failures: allFailures(
      {
        since: parseServerDate(result.range.since),
        until: parseServerDate(result.range.until),
      },
      effective,
    ),
  };
}
