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
import { DataRecord, DataRecordValue } from '@superset-ui/core';

export type TreeNode = {
  name: DataRecordValue;
  value: number;
  secondaryValue: number;
  groupBy: string;
  children?: TreeNode[];
};

function getMetricValue(datum: DataRecord, metric: string) {
  return typeof datum[metric] === 'number' ? (datum[metric] as number) : 0;
}

// Groups records by the raw value of `groupByKey`, keyed with a Map instead
// of a plain object. A plain-object accumulator (e.g. lodash's `groupBy`)
// has to coerce every key to a string to use it as a property name, so a SQL
// NULL and the literal string "null" both collapse to the same "null" key
// and get merged into a single group. A Map keeps them as distinct keys, so
// null filtering stays deterministic regardless of what else is in the
// column.
//
// `Date` values need special handling: a `Map` compares object keys by
// identity, not value, so two separately-parsed `Date` instances for the
// same timestamp would otherwise land in different groups. Canonicalizing
// by epoch time keeps identical timestamps together while still keeping
// `null` and `'null'` distinct.
function groupByValue(
  data: DataRecord[],
  groupByKey: string,
): Map<DataRecordValue, DataRecord[]> {
  const groups = new Map<DataRecordValue, DataRecord[]>();
  const keysByCanonicalTime = new Map<number, DataRecordValue>();
  data.forEach(datum => {
    const rawKey = datum[groupByKey];
    let key = rawKey;
    if (rawKey instanceof Date) {
      const time = rawKey.getTime();
      const existingKey = keysByCanonicalTime.get(time);
      if (existingKey !== undefined) {
        key = existingKey;
      } else {
        keysByCanonicalTime.set(time, rawKey);
      }
    }
    const group = groups.get(key);
    if (group) {
      group.push(datum);
    } else {
      groups.set(key, [datum]);
    }
  });
  return groups;
}

export function treeBuilder(
  data: DataRecord[],
  groupBy: string[],
  metric: string,
  secondaryMetric?: string,
  filterNullNames?: boolean,
): TreeNode[] {
  const [curGroupBy, ...restGroupby] = groupBy;
  const curData = groupByValue(data, curGroupBy);
  const nodes: TreeNode[] = [];
  curData.forEach((value, name) => {
    if (!restGroupby.length) {
      value.forEach(datum => {
        const metricValue = getMetricValue(datum, metric);
        const secondaryValue = secondaryMetric
          ? getMetricValue(datum, secondaryMetric)
          : metricValue;
        nodes.push({
          name,
          value: metricValue,
          secondaryValue,
          groupBy: curGroupBy,
        });
      });
    } else {
      // Children are already null-filtered by the recursive call, so the
      // parent's value/secondaryValue exclude hidden nulls. This keeps the
      // parent arc sized to its visible children (no empty gap).
      const children = treeBuilder(
        value,
        restGroupby,
        metric,
        secondaryMetric,
        filterNullNames,
      );
      const metricValue = children.reduce(
        (prev, cur) => prev + (cur.value as number),
        0,
      );
      const secondaryValue = secondaryMetric
        ? children.reduce(
            (prev, cur) => prev + (cur.secondaryValue as number),
            0,
          )
        : metricValue;
      nodes.push({
        name,
        children,
        value: metricValue,
        secondaryValue,
        groupBy: curGroupBy,
      });
    }
  });
  // Filter at every level so single-level charts and root nodes are covered,
  // not just nested children. A parent whose children were all null-filtered
  // is dropped too: keeping it would leave a zero-value arc that yields a NaN
  // secondaryValue/value ratio for coloring and tooltips.
  return filterNullNames
    ? nodes.filter(node => node.name !== null && node.children?.length !== 0)
    : nodes;
}
