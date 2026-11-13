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
import { SupersetClient, type Level, type Policy } from '@superset-ui/core';
import type { Dayjs } from '@superset-ui/core/utils/dates';
import {
  allFailures,
  type DatasetLimits,
  effectiveLimits,
  type LimitFailure,
  parseServerDate,
} from './rules';
import { LIMIT_REQUEST_OPTIONS } from './requests';

/*
 * The date ranges each chart's data request will be checked against, from
 * `POST /api/v1/time_range_limits/chart_ranges/`, judged with every rule.
 * The server reads the ranges; the browser only judges them.
 */

export const CHART_RANGES_MAX_CHARTS = 50;

export type ChartRangeSource = {
  kind:
    | 'time_range'
    | 'adhoc_filter'
    | 'granularity'
    | 'time_comparison'
    | 'time_shift'
    | 'series_limit';
  query_index: number;
  index: number | null;
};

export type ChartRange = {
  since: string | null;
  until: string | null;
  time_offset: string | null;
  source: ChartRangeSource[] | null;
};

/** The status and JSON body the chart's own data route answers with. */
export type ChartRangesError = {
  status: number;
  body: Record<string, unknown>;
};

/** The body the chart sends to `/api/v1/chart/data`. */
export type ChartRangesEntry = {
  key: string;
  query_context: Record<string, unknown>;
};

export type ChartRangesAnswer =
  | {
      key: string;
      status: 'ok';
      ranges: ChartRange[];
      dataset_id: number | null;
      dashboard_id: number | null;
    }
  | { key: string; status: 'error'; error: ChartRangesError };

export type ChartRangesResult = {
  now: string;
  today: string;
  timezone: string;
  charts: ChartRangesAnswer[];
};

/** One call of `fetchChartRanges`: the keys it sent and its result. */
export type ChartRangesCall = { keys: string[] } & (
  | { result: ChartRangesResult }
  | { failed: true }
);

/**
 * Ask the server for the ranges of every entry, in calls of at most
 * `CHART_RANGES_MAX_CHARTS`. Never throws: a call that fails is `failed`.
 */
export async function fetchChartRanges(
  entries: ChartRangesEntry[],
): Promise<ChartRangesCall[]> {
  const batches: ChartRangesEntry[][] = [];
  for (
    let start = 0;
    start < entries.length;
    start += CHART_RANGES_MAX_CHARTS
  ) {
    batches.push(entries.slice(start, start + CHART_RANGES_MAX_CHARTS));
  }
  return Promise.all(
    batches.map(async (batch): Promise<ChartRangesCall> => {
      const keys = batch.map(entry => entry.key);
      try {
        const { json } = await SupersetClient.post({
          endpoint: '/api/v1/time_range_limits/chart_ranges/',
          jsonPayload: { charts: batch },
          ...LIMIT_REQUEST_OPTIONS,
        });
        const result = json?.result as ChartRangesResult | undefined;
        if (!result || !Array.isArray(result.charts)) {
          return { keys, failed: true };
        }
        return { keys, result };
      } catch {
        return { keys, failed: true };
      }
    }),
  );
}

/** The policies a chart may be judged with: the dashboard or Explore payload. */
export type ChartRangesLevels = {
  global: Policy | null;
  dashboard?: Policy | null;
  datasets?: DatasetLimits[];
};

export type ChartRangeFailure = LimitFailure & { range: ChartRange };

export type ChartRangesJudgement =
  | { status: 'valid' }
  | { status: 'invalid'; failures: ChartRangeFailure[] }
  | { status: 'unbounded'; failures: ChartRangeFailure[] }
  | { status: 'error'; error: ChartRangesError }
  | { status: 'unavailable' };

function judgeAnswer(
  answer: Extract<ChartRangesAnswer, { status: 'ok' }>,
  levels: ChartRangesLevels,
  today: Dayjs,
  now: Dayjs,
): ChartRangesJudgement {
  const dataset = levels.datasets?.find(item => item.id === answer.dataset_id);
  if (dataset?.error) {
    return { status: 'unavailable' };
  }
  const chartLevels: Level[] = [
    { source: 'global', policy: levels.global },
    { source: 'dataset', policy: dataset?.policy ?? null },
    ...(answer.dashboard_id !== null
      ? [{ source: 'dashboard' as const, policy: levels.dashboard ?? null }]
      : []),
  ];
  const limits = effectiveLimits(chartLevels, today, now);
  if (limits === null) {
    return { status: 'valid' };
  }
  if ('unavailable' in limits) {
    return { status: 'unavailable' };
  }
  const dashboardId = answer.dashboard_id ?? undefined;
  let failures: ChartRangeFailure[];
  try {
    failures = answer.ranges.flatMap(range =>
      allFailures(
        {
          since: parseServerDate(range.since),
          until: parseServerDate(range.until),
        },
        limits,
        { timeOffset: range.time_offset ?? undefined, dashboardId },
      ).map(failure => ({ ...failure, range })),
    );
  } catch {
    return { status: 'unavailable' };
  }
  const [first] = failures;
  if (!first) {
    return { status: 'valid' };
  }
  const bothOpen = first.range.since === null && first.range.until === null;
  return {
    status:
      first.reason === 'UNBOUNDED_RANGE' && bothOpen ? 'unbounded' : 'invalid',
    failures,
  };
}

/**
 * Judge each chart of `fetchChartRanges`' calls as the server's query check
 * would: with the global policy, the policy of the chart's own dataset, and the
 * dashboard's only when the server applies it (`dashboard_id`). No limit for a
 * chart lets every range run, an open one too. A range open at both ends is
 * `unbounded`, any other failure `invalid`; a policy with a time grain of no
 * known length is `unavailable`, as is every chart of a failed call. A chart the
 * server couldn't read gets its route's `error`.
 */
export function judgeChartRanges(
  calls: ChartRangesCall[],
  levels: ChartRangesLevels,
): Record<string, ChartRangesJudgement> {
  const judgements: Record<string, ChartRangesJudgement> = {};
  calls.forEach(call => {
    call.keys.forEach(key => {
      judgements[key] = { status: 'unavailable' };
    });
    if (!('result' in call)) {
      return;
    }
    const today = parseServerDate(call.result.today);
    const now = parseServerDate(call.result.now);
    if (!today || !now) {
      return;
    }
    call.result.charts.forEach(answer => {
      judgements[answer.key] =
        answer.status === 'error'
          ? { status: 'error', error: answer.error }
          : judgeAnswer(answer, levels, today, now);
    });
  });
  return judgements;
}
