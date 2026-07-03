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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps, QueryFormData, VizType } from '@superset-ui/core';
import buildQuery from '../src/Bullet/buildQuery';
import transformProps from '../src/transformProps';

const formData: QueryFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  time_range: 'No filter',
  viz_type: VizType.Bullet,
  metric: 'sum__num',
};

describe('Bullet buildQuery', () => {
  test('selects the single ungrouped metric', () => {
    const [query] = buildQuery(formData).queries;
    expect(query.metrics).toEqual(['sum__num']);
    expect(query.columns).toEqual([]);
  });

  test('maps legacy granularity_sqla saved form data', () => {
    const [query] = buildQuery(formData).queries;
    expect(query.granularity).toEqual('ds');
  });
});

describe('Bullet transformProps', () => {
  const baseChartProps = {
    width: 800,
    height: 600,
    datasource: { verboseMap: {} },
    theme: supersetTheme,
    hooks: {},
    initialValues: {},
  };

  test('reshapes v1 records into the measures shape', () => {
    const chartProps = new ChartProps({
      ...baseChartProps,
      formData: { vizType: VizType.Bullet, metric: 'sum__num' },
      queriesData: [{ data: [{ sum__num: 42 }] }],
    });
    const { data } = transformProps(chartProps) as {
      data: { measures: number[] };
    };
    expect(data).toEqual({ measures: [42] });
  });

  test('passes through legacy-shaped measures payloads', () => {
    const chartProps = new ChartProps({
      ...baseChartProps,
      formData: { vizType: VizType.Bullet, metric: 'sum__num' },
      queriesData: [{ data: { measures: [42] } }],
    });
    const { data } = transformProps(chartProps) as {
      data: { measures: number[] };
    };
    expect(data).toEqual({ measures: [42] });
  });

  test('reshapes using adhoc metric labels', () => {
    const chartProps = new ChartProps({
      ...baseChartProps,
      formData: {
        vizType: VizType.Bullet,
        metric: {
          expressionType: 'SIMPLE',
          aggregate: 'SUM',
          column: { column_name: 'num' },
          label: 'SUM(num)',
        },
      },
      queriesData: [{ data: [{ 'SUM(num)': 7 }] }],
    });
    const { data } = transformProps(chartProps) as {
      data: { measures: number[] };
    };
    expect(data).toEqual({ measures: [7] });
  });
});
