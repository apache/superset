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
import { DTTM_ALIAS } from '@superset-ui/core';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/**
 * Rolls a timestamp back to the start of its period the way pandas
 * offset.rollback(normalize=True) does for the offset aliases the
 * frequency control offers (AS/A, MS/M, W and W-XXX, D, H, T/MIN).
 * The multiplier prefix (e.g. 52W-MON) does not change the anchor.
 */
export const rollback = (timestamp: number, freq: string): number => {
  const match = /^\d*(AS|YS|A|Y|MS|M|W(?:-([A-Z]{3}))?|D|H|T|MIN)$/i.exec(
    (freq || 'W-MON').trim(),
  );
  const date = new Date(timestamp);
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  if (!match) {
    return midnight; // freeform rules fall back to day boundaries
  }
  const unit = match[1].toUpperCase();
  if (unit === 'AS' || unit === 'YS') {
    return Date.UTC(date.getUTCFullYear(), 0, 1);
  }
  if (unit === 'A' || unit === 'Y') {
    // most recent Dec 31 at or before the timestamp
    const yearEnd = Date.UTC(date.getUTCFullYear(), 11, 31);
    return midnight >= yearEnd
      ? yearEnd
      : Date.UTC(date.getUTCFullYear() - 1, 11, 31);
  }
  if (unit === 'MS') {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  if (unit === 'M') {
    // most recent month end at or before the timestamp
    const monthEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
    return midnight >= monthEnd
      ? monthEnd
      : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0);
  }
  if (unit.startsWith('W')) {
    const anchor = match[2] ? WEEKDAYS.indexOf(match[2].toUpperCase()) : 6; // W defaults to W-SUN
    // JS getUTCDay: 0=SUN..6=SAT; WEEKDAYS index: 0=MON..6=SUN
    const jsAnchor = anchor === 6 ? 0 : anchor + 1;
    const diff = (date.getUTCDay() - jsAnchor + 7) % 7;
    return midnight - diff * DAY_MS;
  }
  if (unit === 'D') {
    return midnight;
  }
  if (unit === 'H') {
    return timestamp - (timestamp % (60 * 60 * 1000));
  }
  return timestamp - (timestamp % (60 * 1000)); // T / MIN
};

export interface TimePivotSeries {
  key: string;
  values: { x: number; y: number | null }[];
  rank: number;
  perc: number;
}

/**
 * Ports the legacy NVD3TimePivotViz.get_data reshape: timestamps are
 * bucketed into periods by the freq offset, ranked most-recent-first
 * ("current", "-1", "-2", ...), shifted onto the latest period's time
 * axis, and pivoted into one series per period with rank/perc metadata.
 */
export default function transformData(
  records: Record<string, unknown>[],
  metricLabel: string,
  freq: string,
): TimePivotSeries[] {
  const rows = records
    .filter(record => record[DTTM_ALIAS] != null)
    .map(record => {
      const timestamp = record[DTTM_ALIAS] as number;
      return {
        timestamp,
        period: rollback(timestamp, freq),
        value: record[metricLabel] as number | null,
      };
    });
  if (rows.length === 0) {
    return [];
  }

  const periods = Array.from(new Set(rows.map(row => row.period))).sort(
    (a, b) => b - a,
  );
  const maxPeriod = periods[0];
  const rankOf = new Map(periods.map((period, index) => [period, index]));
  const maxRank = periods.length - 1;

  const seriesOf = (rank: number) => (rank === 0 ? 'current' : `-${rank}`);

  // shift every point onto the latest period's time axis
  const values = new Map<string, Map<number, number | null>>();
  const shiftedTimestamps = new Set<number>();
  rows.forEach(({ timestamp, period, value }) => {
    const series = seriesOf(rankOf.get(period)!);
    const shifted = timestamp + (maxPeriod - period);
    shiftedTimestamps.add(shifted);
    if (!values.has(series)) {
      values.set(series, new Map());
    }
    values.get(series)!.set(shifted, value);
  });

  const timestamps = Array.from(shiftedTimestamps).sort((a, b) => a - b);
  // pandas pivot sorts the series labels lexicographically
  const seriesLabels = Array.from(values.keys()).sort();

  const chartData: TimePivotSeries[] = [];
  seriesLabels.forEach(series => {
    const seriesValues = values.get(series)!;
    let nonNullCount = 0;
    const points = timestamps.map(timestamp => {
      let y = seriesValues.has(timestamp) ? seriesValues.get(timestamp)! : null;
      if (typeof y === 'number' && Number.isNaN(y)) {
        y = null;
      }
      if (y != null) {
        nonNullCount += 1;
      }
      return { x: timestamp, y };
    });
    if (nonNullCount === 0) {
      return;
    }
    const rank = series === 'current' ? 0 : Number(series.slice(1));
    chartData.push({
      key: series,
      values: points,
      rank,
      perc: 1 - rank / (maxRank + 1),
    });
  });
  return chartData;
}
