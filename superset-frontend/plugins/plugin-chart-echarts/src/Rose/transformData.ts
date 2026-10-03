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

export interface RoseEntry {
  key: string | string[];
  value: number;
  name: string | string[];
  time: unknown;
}

export type RoseData = Record<string, RoseEntry[]>;

/** Splits a flattened pivot column label on ", " honoring "\," escapes. */
export const splitFlatLabel = (label: string): string[] =>
  label.split(/(?<!\\), /).map(part => part.replace(/\\,/g, ','));

interface SeriesKeyOptions {
  metricLabels: string[];
  timeCompare: string[];
  comparisonType?: string;
}

/**
 * Recovers the legacy to_series key for a flattened pivot column:
 * the metric is dropped from grouped single-metric keys, time-shifted
 * columns get the legacy "<offset> offset" suffix, and comparison
 * columns (difference__m__m__offset) collapse to the same suffix form.
 */
export const seriesKeyOf = (
  parts: string[],
  { metricLabels, timeCompare, comparisonType }: SeriesKeyOptions,
): string | string[] | null => {
  const [head, ...groups] = parts;
  const hasGroup = groups.length > 0;
  const singleMetric = metricLabels.length === 1;

  const baseKey = (metric: string): string | string[] => {
    if (!hasGroup) {
      return metric;
    }
    return singleMetric ? groups : [metric, ...groups];
  };

  if (comparisonType && comparisonType !== 'values') {
    // head looks like `${comparisonType}__${metric}__${metric}__${offset}`
    const prefix = `${comparisonType}__`;
    if (!head.startsWith(prefix)) {
      return null; // originals are dropped in comparison mode
    }
    const rest = head.slice(prefix.length);
    const metric = metricLabels.find(label =>
      rest.startsWith(`${label}__${label}__`),
    );
    if (!metric) {
      return null;
    }
    const offset = rest.slice(metric.length * 2 + 4);
    const base = baseKey(metric);
    const suffix = `${offset} offset`;
    return Array.isArray(base) ? [...base, suffix] : [base, suffix];
  }

  // values mode: time-shifted columns are named `${metric}__${offset}`
  for (const metric of metricLabels) {
    for (const offset of timeCompare) {
      if (head === `${metric}__${offset}`) {
        const base = baseKey(metric);
        const suffix = `${offset} offset`;
        return Array.isArray(base) ? [...base, suffix] : [base, suffix];
      }
    }
  }
  return baseKey(head);
};

/**
 * Ports the legacy RoseViz.get_data reshape: the pivoted series are
 * re-keyed by timestamp, one entry per series with NaN collapsed to 0.
 */
export default function transformData(
  records: Record<string, unknown>[],
  options: SeriesKeyOptions,
): RoseData {
  const columns = new Set<string>();
  records.forEach(record => {
    Object.keys(record).forEach(column => {
      if (column !== DTTM_ALIAS) {
        columns.add(column);
      }
    });
  });

  const series: { key: string | string[]; column: string }[] = [];
  columns.forEach(column => {
    const key = seriesKeyOf(splitFlatLabel(column), options);
    if (key != null) {
      series.push({ key, column });
    }
  });
  // legacy sort_series=False sorts the series by key
  series.sort((a, b) => {
    const aKey = Array.isArray(a.key) ? a.key.join(' ') : a.key;
    const bKey = Array.isArray(b.key) ? b.key.join(' ') : b.key;
    if (aKey === bKey) return 0;
    return aKey < bKey ? -1 : 1;
  });

  const sorted = [...records].sort((a, b) => {
    const aTime = a[DTTM_ALIAS] as number;
    const bTime = b[DTTM_ALIAS] as number;
    return aTime === bTime ? 0 : aTime < bTime ? -1 : 1;
  });

  const result: RoseData = {};
  sorted.forEach(record => {
    const timestamp = record[DTTM_ALIAS] as number;
    const entries: RoseEntry[] = series.map(({ key, column }) => {
      const raw = record[column];
      const value = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0;
      return { key, value, name: key, time: timestamp };
    });
    result[String(timestamp)] = entries;
  });
  return result;
}
