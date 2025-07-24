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
): TreeNode[] {
  const [curGroupBy, ...restGroupby] = groupBy;
  const curData = _groupBy(data, curGroupBy);
  return transform(
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
        const children = treeBuilder(
          value,
          restGroupby,
          metric,
          secondaryMetric,
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
}
