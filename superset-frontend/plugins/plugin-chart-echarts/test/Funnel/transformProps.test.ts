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
import {
  ChartProps,
  getNumberFormatter,
  supersetTheme,
} from '@superset-ui/core';
import transformProps, {
  formatFunnelLabel,
} from '../../src/Funnel/transformProps';
import {
  EchartsFunnelChartProps,
  EchartsFunnelLabelTypeType,
  PercentCalcType,
} from '../../src/Funnel/types';

describe('Funnel transformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { foo: 'Sylvester', bar: 1, sum__num: 10 },
          { foo: 'Arnold', bar: 2, sum__num: 2.5 },
        ],
      },
    ],
    theme: supersetTheme,
  });

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
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Key,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('My Label');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Value,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('1.23k');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Percent,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('12.34%');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Percent,
        percentCalculationType: PercentCalcType.FIRST_STEP,
      }),
    ).toEqual('50.00%');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Percent,
        percentCalculationType: PercentCalcType.PREV_STEP,
      }),
    ).toEqual('85.00%');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.KeyValue,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('My Label: 1.23k');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.KeyPercent,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('My Label: 12.34%');
    expect(
      formatFunnelLabel({
        params,
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.KeyValuePercent,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('My Label: 1.23k (12.34%)');
    expect(
      formatFunnelLabel({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Key,
        percentCalculationType: PercentCalcType.TOTAL,
      }),
    ).toEqual('<NULL>');
    expect(
      formatFunnelLabel({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        labelType: EchartsFunnelLabelTypeType.Key,
        percentCalculationType: PercentCalcType.TOTAL,
        sanitizeName: true,
      }),
    ).toEqual('&lt;NULL&gt;');
  });
});
