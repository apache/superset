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

export interface PartitionNode {
  name: unknown;
  val?: number | null;
  children: PartitionNode[];
}

type Row = Record<string, unknown>;

interface Options {
  groupbyLabels: string[];
  metricLabels: string[];
  timeSeriesOption?: string;
  rollingType?: string;
  rollingPeriods?: number;
  minPeriods?: number;
  contribution?: boolean;
}

const numeric = (value: unknown): number | null =>
  typeof value === 'number' && !Number.isNaN(value) ? value : null;

const sortedUnique = (values: unknown[]): unknown[] =>
  Array.from(new Set(values)).sort((a, b) => {
    if (a === b) return 0;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : 1;
  });

/** pandas-style aggregate: sum skips nulls, mean of nothing is null */
const aggregate = (rows: Row[], metric: string, op: 'sum' | 'mean') => {
  let total = 0;
  let count = 0;
  rows.forEach(row => {
    const value = numeric(row[metric]);
    if (value != null) {
      total += value;
      count += 1;
    }
  });
  if (op === 'mean') {
    return count === 0 ? null : total / count;
  }
  return total;
};

/**
 * Ports PartitionViz.levels_for + nest_values: aggregate each metric at
 * every prefix of the group hierarchy and nest the values top-down. The
 * `groups` list may include the timestamp column for the plain
 * time-series option, exactly like the backend prepended DTTM_ALIAS.
 */
function nestAggregates(
  records: Row[],
  groups: string[],
  metricLabels: string[],
  op: 'sum' | 'mean',
): PartitionNode[] {
  const nest = (
    metric: string,
    rows: Row[],
    level: number,
    dims: unknown[],
  ): PartitionNode[] => {
    if (level > groups.length - 1) {
      return [];
    }
    const column = groups[level];
    return sortedUnique(rows.map(row => row[column])).map(value => {
      const subset = rows.filter(row => row[column] === value);
      return {
        // deeper levels carry the dim path in the name, like the backend
        name: level === 0 ? value : [...dims, value],
        val: aggregate(subset, metric, op),
        children: nest(metric, subset, level + 1, [...dims, value]),
      };
    });
  };
  return metricLabels.map(metric => ({
    name: metric,
    val: aggregate(records, metric, op),
    children: nest(metric, records, 0, []),
  }));
}

/**
 * Ports PartitionViz.levels_for_diff + nest_values: compare the last
 * time grain against the first one at every hierarchy prefix.
 */
function nestPointComparison(
  records: Row[],
  groups: string[],
  metricLabels: string[],
  timeOp: 'point_diff' | 'point_factor' | 'point_percent',
): PartitionNode[] {
  const times = sortedUnique(records.map(row => row[DTTM_ALIAS])) as number[];
  const since = times[0];
  const until = times[times.length - 1];

  // top-level comparison has no fill: a plain a-b / a/b / a/b-1
  const topCompare = (a: number, b: number) => {
    if (timeOp === 'point_diff') return a - b;
    if (timeOp === 'point_factor') return a / b;
    return a / b - 1;
  };
  // grouped comparisons treat missing sides as 0 (pandas fill_value=0)
  const groupedCompare = (a: number | null, b: number | null) => {
    const u = a ?? 0;
    const s = b ?? 0;
    if (timeOp === 'point_diff') return u - s;
    if (timeOp === 'point_factor') return u / s;
    return u / s - 1;
  };

  const nest = (
    metric: string,
    rows: Row[],
    level: number,
    dims: unknown[],
  ): PartitionNode[] => {
    if (level > groups.length - 1) {
      return [];
    }
    const column = groups[level];
    return sortedUnique(rows.map(row => row[column])).map(value => {
      const subset = rows.filter(row => row[column] === value);
      const untilRows = subset.filter(row => row[DTTM_ALIAS] === until);
      const sinceRows = subset.filter(row => row[DTTM_ALIAS] === since);
      const untilValue = untilRows.length
        ? aggregate(untilRows, metric, 'sum')
        : null;
      const sinceValue = sinceRows.length
        ? aggregate(sinceRows, metric, 'sum')
        : null;
      return {
        name: level === 0 ? value : [...dims, value],
        val: groupedCompare(untilValue, sinceValue),
        children: nest(metric, subset, level + 1, [...dims, value]),
      };
    });
  };

  return metricLabels.map(metric => {
    const untilTotal = aggregate(
      records.filter(row => row[DTTM_ALIAS] === until),
      metric,
      'sum',
    ) as number;
    const sinceTotal = aggregate(
      records.filter(row => row[DTTM_ALIAS] === since),
      metric,
      'sum',
    ) as number;
    return {
      name: metric,
      val: topCompare(untilTotal, sinceTotal),
      children: nest(metric, records, 0, []),
    };
  });
}

/** apply_rolling equivalent over a time-indexed value list */
function applyRolling(
  values: (number | null)[],
  rollingType: string | undefined,
  rollingPeriods: number,
  minPeriods: number,
): (number | null)[] {
  let result = values;
  if (
    rollingType &&
    ['mean', 'sum', 'std'].includes(rollingType) &&
    rollingPeriods
  ) {
    result = values.map((_, index) => {
      const start = Math.max(0, index - rollingPeriods + 1);
      const window = values
        .slice(start, index + 1)
        .filter((v): v is number => v != null);
      if (window.length < Math.max(minPeriods, 1)) {
        return null;
      }
      const sum = window.reduce((acc, v) => acc + v, 0);
      if (rollingType === 'sum') return sum;
      const mean = sum / window.length;
      if (rollingType === 'mean') return mean;
      if (window.length < 2) return null;
      const variance =
        window.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
        (window.length - 1);
      return Math.sqrt(variance);
    });
  } else if (rollingType === 'cumsum') {
    let running = 0;
    result = values.map(value => {
      running += value ?? 0;
      return running;
    });
  }
  return result;
}

/**
 * Ports PartitionViz.levels_for_time + nest_procs for the "period
 * analysis" option: pivot each hierarchy prefix per timestamp (sum,
 * missing filled with 0), apply the rolling window and contribution the
 * way process_data did, and nest as metric -> time -> group levels.
 */
function nestProcs(
  records: Row[],
  groups: string[],
  options: Options,
): PartitionNode[] {
  const {
    metricLabels,
    rollingType,
    rollingPeriods = 0,
    minPeriods = 0,
    contribution,
  } = options;
  const allTimes = sortedUnique(records.map(row => row[DTTM_ALIAS]));
  // rolling windows may trim the leading periods
  const times = minPeriods ? allTimes.slice(minPeriods) : allTimes;

  // value series per (level, metric, group tuple)
  const seriesFor = (
    metric: string,
    rows: Row[],
  ): Map<unknown, number | null> => {
    const perTime = new Map<unknown, number | null>();
    allTimes.forEach(time => {
      const timeRows = rows.filter(row => row[DTTM_ALIAS] === time);
      // pivot fill_value=0: missing combinations become 0
      perTime.set(
        time,
        timeRows.length ? aggregate(timeRows, metric, 'sum') : 0,
      );
    });
    let values: (number | null)[] = allTimes.map(
      time => perTime.get(time) ?? 0,
    );
    values = applyRolling(values, rollingType, rollingPeriods, minPeriods);
    const result = new Map<unknown, number | null>();
    allTimes.forEach((time, index) => result.set(time, values[index]));
    return result;
  };

  // contribution normalizes each timestamp across every column of the
  // same level (all metric x group-tuple combinations)
  const buildLevel = (
    level: number,
  ): Map<string, Map<unknown, number | null>> => {
    const columns = new Map<string, Row[]>();
    metricLabels.forEach(metric => {
      if (level === 0) {
        columns.set(JSON.stringify([metric]), records);
      } else {
        const tuples = new Map<string, Row[]>();
        records.forEach(row => {
          const key = JSON.stringify([
            metric,
            ...groups.slice(0, level).map(label => row[label]),
          ]);
          const bucket = tuples.get(key);
          if (bucket) {
            bucket.push(row);
          } else {
            tuples.set(key, [row]);
          }
        });
        tuples.forEach((rows, key) => columns.set(key, rows));
      }
    });
    const built = new Map<string, Map<unknown, number | null>>();
    columns.forEach((rows, key) => {
      built.set(key, seriesFor(JSON.parse(key)[0], rows));
    });
    if (contribution) {
      allTimes.forEach(time => {
        let total = 0;
        built.forEach(series => {
          total += series.get(time) ?? 0;
        });
        built.forEach(series => {
          const value = series.get(time);
          series.set(time, total === 0 ? null : (value ?? 0) / total);
        });
      });
    }
    return built;
  };

  const levels = groups.map((_, index) => buildLevel(index + 1));
  const level0 = buildLevel(0);

  const nest = (
    metric: string,
    level: number,
    dims: unknown[],
    time: unknown,
  ): PartitionNode[] => {
    if (level > groups.length) {
      return [];
    }
    const built = levels[level - 1];
    const wanted = [metric, ...dims];
    const children: PartitionNode[] = [];
    built.forEach((series, key) => {
      const parts = JSON.parse(key) as unknown[];
      if (
        parts.length !== wanted.length + 1 ||
        !wanted.every((part, index) => parts[index] === part)
      ) {
        return;
      }
      const name = parts[parts.length - 1];
      children.push({
        name,
        val: series.get(time) ?? null,
        children: nest(metric, level + 1, [...dims, name], time),
      });
    });
    return children;
  };

  return metricLabels.map(metric => ({
    name: metric,
    children: times.map(time => ({
      name: time,
      val: level0.get(JSON.stringify([metric]))?.get(time) ?? null,
      children: nest(metric, 1, [], time),
    })),
  }));
}

/**
 * Ports the legacy PartitionViz.get_data dispatch across the
 * time-series options.
 */
export default function transformData(
  records: Row[],
  options: Options,
): PartitionNode[] {
  const {
    groupbyLabels,
    metricLabels,
    timeSeriesOption = 'not_time',
  } = options;
  if (groupbyLabels.length === 0) {
    throw new Error('Please choose at least one groupby');
  }
  if (records.length === 0) {
    return []; // the legacy endpoint returned no data for an empty frame
  }
  if (timeSeriesOption === 'not_time' || timeSeriesOption === 'agg_sum') {
    return nestAggregates(records, groupbyLabels, metricLabels, 'sum');
  }
  if (timeSeriesOption === 'agg_mean') {
    return nestAggregates(records, groupbyLabels, metricLabels, 'mean');
  }
  if (
    timeSeriesOption === 'point_diff' ||
    timeSeriesOption === 'point_factor' ||
    timeSeriesOption === 'point_percent'
  ) {
    return nestPointComparison(
      records,
      groupbyLabels,
      metricLabels,
      timeSeriesOption,
    );
  }
  if (timeSeriesOption === 'adv_anal') {
    return nestProcs(records, groupbyLabels, options);
  }
  // 'time_series': aggregate with the timestamp as the first level
  return nestAggregates(
    records,
    [DTTM_ALIAS, ...groupbyLabels],
    metricLabels,
    'sum',
  );
}
