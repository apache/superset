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
import { ChartProps, getNumberFormatter } from '@superset-ui/core';
import transformProps, { parseParams } from '../../src/Funnel/transformProps';
import {
  EchartsFunnelChartProps,
  PercentCalcType,
} from '../../src/Funnel/types';

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'sum__num',
  groupby: ['foo', 'bar'],
};
const queriesData = [
  {
    data: [
      { foo: 'Sylvester', bar: 1, sum__num: 10 },
      { foo: 'Arnold', bar: 2, sum__num: 2.5 },
    ],
  },
];
const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData,
});

describe('Funnel transformProps', () => {
  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsFunnelChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
            }),
          ],
        }),
      }),
    );
  });
});

describe('formatFunnelLabel', () => {
  it('should generate a valid funnel chart label', () => {
    const numberFormatter = getNumberFormatter();
    const params = {
      name: 'My Label',
      value: 1234,
      percent: 12.34,
      data: { firstStepPercent: 0.5, prevStepPercent: 0.85 },
    };
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
      }),
    ).toEqual(['My Label', '1.23k', '12.34%']);
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.FirstStep,
      }),
    ).toEqual(['My Label', '1.23k', '50.00%']);
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.PreviousStep,
      }),
    ).toEqual(['My Label', '1.23k', '85.00%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
      }),
    ).toEqual(['<NULL>', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
        sanitizeName: true,
      }),
    ).toEqual(['&lt;NULL&gt;', '1.23k', '12.34%']);
  });
});

describe('legend sorting', () => {
  const legendQueriesData = [
    {
      data: [
        { foo: 'Sylvester', sum__num: 10 },
        { foo: 'Arnold', sum__num: 2.5 },
        { foo: 'Mark', sum__num: 13 },
      ],
    },
  ];
  const createChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartProps,
      formData: {
        ...formData,
        groupby: ['foo'],
        ...overrides,
      },
      queriesData: legendQueriesData,
    });

  it('preserves original data order when no sort specified', () => {
    const props = createChartProps({ legendSort: null });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Sylvester', 'Arnold', 'Mark']);
  });

  it('sorts alphabetically ascending when legendSort is "asc"', () => {
    const props = createChartProps({ legendSort: 'asc' });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Arnold', 'Mark', 'Sylvester']);
  });

  it('sorts alphabetically descending when legendSort is "desc"', () => {
    const props = createChartProps({ legendSort: 'desc' });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Sylvester', 'Mark', 'Arnold']);
  });
});
