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
import { groupBy as _groupBy, transform } from 'lodash';

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

export function treeBuilder(
  data: DataRecord[],
  groupBy: string[],
  metric: string,
  secondaryMetric?: string,
  filterNullNames?: boolean,
): TreeNode[] {
  const [curGroupBy, ...restGroupby] = groupBy;
  const curData = _groupBy(data, curGroupBy);
  const nodes = transform(
    curData,
    (result, value, key) => {
      const name = curData[key][0][curGroupBy]!;
      if (!restGroupby.length) {
        (value ?? []).forEach(datum => {
          const metricValue = getMetricValue(datum, metric);
          const secondaryValue = secondaryMetric
            ? getMetricValue(datum, secondaryMetric)
            : metricValue;
          const item = {
            name,
            value: metricValue,
            secondaryValue,
            groupBy: curGroupBy,
          };
          result.push(item);
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
        result.push({
          name,
          children,
          value: metricValue,
          secondaryValue,
          groupBy: curGroupBy,
        });
      }
    },
    [] as TreeNode[],
  );
  // Filter at every level so single-level charts and root nodes are covered,
  // not just nested children. A parent whose children were all null-filtered
  // is dropped too: keeping it would leave a zero-value arc that yields a NaN
  // secondaryValue/value ratio for coloring and tooltips.
  return filterNullNames
    ? nodes.filter(
        node => node.name !== null && node.children?.length !== 0,
      )
    : nodes;
}
