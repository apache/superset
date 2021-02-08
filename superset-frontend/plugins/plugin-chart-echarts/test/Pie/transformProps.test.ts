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
import transformProps, { formatPieLabel } from '../../src/Pie/transformProps';
import { EchartsPieLabelType } from '../../src/Pie/types';

describe('Pie tranformProps', () => {
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
  });

  it('should tranform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              avoidLabelOverlap: true,
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

describe('formatPieLabel', () => {
  it('should generate a valid pie chart label', () => {
    const numberFormatter = getNumberFormatter();
    const params = { name: 'My Label', value: 1234, percent: 12.34 };
    expect(formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.Key })).toEqual(
      'My Label',
    );
    expect(
      formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.Value }),
    ).toEqual('1.23k');
    expect(
      formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.Percent }),
    ).toEqual('12.34%');
    expect(
      formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.KeyValue }),
    ).toEqual('My Label: 1.23k');
    expect(
      formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.KeyPercent }),
    ).toEqual('My Label: 12.34%');
    expect(
      formatPieLabel({ params, numberFormatter, labelType: EchartsPieLabelType.KeyValuePercent }),
    ).toEqual('My Label: 1.23k (12.34%)');
  });
});
