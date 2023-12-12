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
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import { EchartsBubbleChartProps } from 'plugins/plugin-chart-echarts/src/Bubble/types';

import transformProps, { formatTooltip } from '../../src/Bubble/transformProps';

describe('Bubble transformProps', () => {
  const formData: SqlaFormData = {
    datasource: '1__table',
    viz_type: 'echarts_bubble',
    entity: 'customer_name',
    x: 'count',
    y: {
      aggregate: 'sum',
      column: {
        column_name: 'price_each',
      },
      expressionType: 'simple',
      label: 'SUM(price_each)',
    },
    size: {
      aggregate: 'sum',
      column: {
        column_name: 'sales',
      },
      expressionType: 'simple',
      label: 'SUM(sales)',
    },
    xAxisBounds: [null, null],
    yAxisBounds: [null, null],
  };
  const chartProps = new ChartProps({
    formData,
    height: 800,
    width: 800,
    queriesData: [
      {
        data: [
          {
            customer_name: 'AV Stores, Co.',
            count: 10,
            'SUM(price_each)': 20,
            'SUM(sales)': 30,
          },
          {
            customer_name: 'Alpha Cognac',
            count: 40,
            'SUM(price_each)': 50,
            'SUM(sales)': 60,
          },
          {
            customer_name: 'Amica Models & Co.',
            count: 70,
            'SUM(price_each)': 80,
            'SUM(sales)': 90,
          },
        ],
      },
    ],
    theme: supersetTheme,
  });

  it('Should transform props for viz', () => {
    expect(transformProps(chartProps as EchartsBubbleChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 800,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: expect.arrayContaining([
                [10, 20, 30, 'AV Stores, Co.', null],
              ]),
            }),
            expect.objectContaining({
              data: expect.arrayContaining([
                [40, 50, 60, 'Alpha Cognac', null],
              ]),
            }),
            expect.objectContaining({
              data: expect.arrayContaining([
                [70, 80, 90, 'Amica Models & Co.', null],
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});

describe('Bubble formatTooltip', () => {
  const dollerFormatter = getNumberFormatter('$,.2f');
  const percentFormatter = getNumberFormatter(',.1%');

  it('Should generate correct bubble label content with dimension', () => {
    const params = {
      data: [10000, 20000, 3, 'bubble title', 'bubble dimension'],
    };

    expect(
      formatTooltip(
        params,
        'x-axis-label',
        'y-axis-label',
        'size-label',
        dollerFormatter,
        dollerFormatter,
        percentFormatter,
      ),
    ).toEqual(
      `<p>bubble title </br> bubble dimension</p>
        x-axis-label: $10,000.00 <br/>
        y-axis-label: $20,000.00 <br/>
        size-label: 300.0%`,
    );
  });
  it('Should generate correct bubble label content without dimension', () => {
    const params = {
      data: [10000, 25000, 3, 'bubble title', null],
    };
    expect(
      formatTooltip(
        params,
        'x-axis-label',
        'y-axis-label',
        'size-label',
        dollerFormatter,
        dollerFormatter,
        percentFormatter,
      ),
    ).toEqual(
      `<p>bubble title</p>
        x-axis-label: $10,000.00 <br/>
        y-axis-label: $25,000.00 <br/>
        size-label: 300.0%`,
    );
  });
});
