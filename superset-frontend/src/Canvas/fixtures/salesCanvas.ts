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

import { CanvasDefinition, CdlQueryContext } from '../types';
import { QueryResult } from '../resolve';
import { QueryRunner } from '../runtime';

/**
 * Demo canvas: a Region select two-way bound to `$region`, a Reset button, and
 * a bound echarts line chart whose query filters on `$region`. Changing the
 * select re-runs the query — the reactive loop the prototype proves.
 */
export const salesCanvas: CanvasDefinition = {
  cdlVersion: 2,
  variables: {
    region: { type: 'string', default: 'APAC', scope: 'query' },
  },
  tree: {
    id: 'root',
    type: 'Column',
    children: [
      {
        id: 'title',
        type: 'Markdown',
        props: { text: 'Monthly sales by region' },
      },
      {
        id: 'controls',
        type: 'Row',
        children: [
          {
            id: 'region-select',
            type: 'Select',
            props: {
              label: 'Region',
              options: [
                { value: 'APAC', label: 'APAC' },
                { value: 'EMEA', label: 'EMEA' },
                { value: 'AMER', label: 'AMER' },
              ],
            },
            bind: { value: '$region' },
          },
          {
            id: 'reset',
            type: 'Button',
            props: { children: 'Reset', buttonStyle: 'secondary' },
            on: {
              click: [{ action: 'setVariable', name: 'region', value: 'APAC' }],
            },
          },
        ],
      },
      {
        id: 'chart',
        type: 'Viz',
        renderer: 'echarts',
        data: {
          queryContext: {
            datasetId: 1,
            metrics: ['SUM(sales)'],
            groupby: ['month'],
            filters: [{ col: 'region', op: '==', val: '$region' }],
          },
          encoding: { x: 'month', y: 'SUM(sales)' },
        },
        option: {
          series: [{ type: 'line', smooth: true }],
          tooltip: {
            trigger: 'axis',
            valueFormatter: { kind: 'currency', currency: 'USD' },
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: { kind: 'currency', currency: 'USD' } },
          },
        },
      },
    ],
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SERIES_BY_REGION: Record<string, number[]> = {
  APAC: [120, 132, 101, 134, 90, 230],
  EMEA: [220, 182, 191, 234, 290, 330],
  AMER: [150, 232, 201, 154, 190, 330],
};

/** In-memory QueryRunner standing in for /api/v1/chart/data during the prototype. */
export function createMockRunner(delayMs = 0): QueryRunner {
  return {
    run: (queryContext: CdlQueryContext): Promise<QueryResult> => {
      const regionFilter = queryContext.filters?.find(f => f.col === 'region');
      const region = String(regionFilter?.val ?? 'APAC');
      const values = SERIES_BY_REGION[region] ?? SERIES_BY_REGION.APAC;
      const records = MONTHS.map((month, i) => ({
        month,
        'SUM(sales)': values[i] * 1000,
      }));
      return new Promise(resolve => {
        setTimeout(
          () => resolve({ columns: ['month', 'SUM(sales)'], records }),
          delayMs,
        );
      });
    },
  };
}
