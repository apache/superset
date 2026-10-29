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

export interface TTestSeries {
  group: unknown[] | string;
  values: { x: unknown; y: unknown }[];
}

export type TTestData = Record<string, TTestSeries[]>;

/**
 * Ports the legacy PairedTTestViz.get_data reshape: pivot the timeseries
 * records on the timestamp with one series per (metric, group tuple),
 * padding missing timestamps with null the way pandas pivot_table did.
 */
export default function transformData(
  records: Record<string, unknown>[],
  groupbyLabels: string[],
  metricLabels: string[],
): TTestData {
  const timestamps = Array.from(
    new Set(records.map(record => record[DTTM_ALIAS])),
  ).sort((a, b) => {
    if (a === b) return 0;
    return (a as number) < (b as number) ? -1 : 1;
  });

  const hasGroup = groupbyLabels.length > 0;
  const groupKeyOf = (record: Record<string, unknown>) =>
    JSON.stringify(groupbyLabels.map(label => record[label]));

  // groupKey -> tuple of group values, sorted like pandas pivot columns
  const groupTuples = new Map<string, unknown[]>();
  // metric -> groupKey -> timestamp -> value
  const values = new Map<string, Map<string, Map<unknown, unknown>>>();
  metricLabels.forEach(metric => values.set(metric, new Map()));

  records.forEach(record => {
    const groupKey = groupKeyOf(record);
    if (!groupTuples.has(groupKey)) {
      groupTuples.set(
        groupKey,
        groupbyLabels.map(label => record[label]),
      );
    }
    metricLabels.forEach(metric => {
      const byGroup = values.get(metric)!;
      if (!byGroup.has(groupKey)) {
        byGroup.set(groupKey, new Map());
      }
      byGroup.get(groupKey)!.set(record[DTTM_ALIAS], record[metric]);
    });
  });

  // element-wise tuple comparison so numeric groups sort numerically,
  // matching the pandas pivot column ordering
  const compareTuples = (a: unknown[], b: unknown[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        if (typeof a[i] === 'number' && typeof b[i] === 'number') {
          return (a[i] as number) - (b[i] as number);
        }
        return String(a[i]) < String(b[i]) ? -1 : 1;
      }
    }
    return a.length - b.length;
  };
  const sortedGroupKeys = Array.from(groupTuples.entries())
    .sort(([, a], [, b]) => compareTuples(a, b))
    .map(([key]) => key);

  const data: TTestData = {};
  metricLabels.forEach(metric => {
    const byGroup = values.get(metric)!;
    const seriesKeys = hasGroup ? sortedGroupKeys : [groupKeyOf({})];
    data[metric] = seriesKeys.map(groupKey => ({
      group: hasGroup ? groupTuples.get(groupKey)! : 'All',
      values: timestamps.map(timestamp => ({
        x: timestamp,
        y: byGroup.get(groupKey)?.get(timestamp) ?? null,
      })),
    }));
  });
  return data;
}
