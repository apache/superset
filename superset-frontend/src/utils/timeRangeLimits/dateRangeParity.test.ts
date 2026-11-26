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
import { readFileSync } from 'fs';
import path from 'path';
import {
  allFailures,
  dashboardLimitLevels,
  DatasetLimits,
  effectiveLimits,
  Level,
  parseServerDate,
  Policy,
} from '.';

type ParityCase = {
  id: string;
  now: string;
  levels?: [Level['source'], Policy][];
  // A tie case: the dashboard payload, whose levels the browser builds.
  payload?: {
    global: Policy | null;
    dashboard: Policy | null;
    datasets: DatasetLimits[];
  };
  since: string | null;
  until: string | null;
  time_offset?: string;
  dashboard_id?: number;
  expected: Record<string, unknown>;
};

// The server half, tests/unit_tests/utils/test_date_range_parity.py, reads the
// same file.
const { cases }: { cases: ParityCase[] } = JSON.parse(
  readFileSync(
    path.join(__dirname, '../../../spec/fixtures/dateRangeParity.json'),
    'utf8',
  ),
);

const browserOutcome = (parityCase: ParityCase): Record<string, unknown> => {
  const now = parseServerDate(parityCase.now)!;
  const levels: Level[] = parityCase.payload
    ? dashboardLimitLevels(parityCase.payload)
    : (parityCase.levels ?? []).map(([source, policy]) => ({
        source,
        policy,
      }));
  const limits = effectiveLimits(levels, now.startOf('day'), now);
  if (limits === null) {
    return { outcome: 'no_limits' };
  }
  if ('unavailable' in limits) {
    return { outcome: 'invalid_policy' };
  }
  let failures;
  try {
    failures = allFailures(
      {
        since: parseServerDate(parityCase.since),
        until: parseServerDate(parityCase.until),
      },
      limits,
      {
        timeOffset: parityCase.time_offset,
        dashboardId: parityCase.dashboard_id,
      },
    );
  } catch {
    return { outcome: 'since_after_until' };
  }
  if (!failures.length) {
    return { outcome: 'pass' };
  }
  const [{ reason, rule, limit, message }] = failures;
  return {
    outcome: 'failure',
    reason_code: reason,
    rule,
    source: limit?.source ?? null,
    limit: limit
      ? { quantity: limit.quantity, time_grain: limit.time_grain }
      : null,
    message,
  };
};

test.each(cases.map(parityCase => [parityCase.id, parityCase] as const))(
  'parity case %s',
  (_id, parityCase) => {
    expect(browserOutcome(parityCase)).toEqual(parityCase.expected);
  },
);
