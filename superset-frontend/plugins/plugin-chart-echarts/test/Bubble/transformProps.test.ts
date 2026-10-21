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
  ChartPropsConfig,
  getNumberFormatter,
  SqlaFormData,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { EchartsBubbleChartProps } from '../../src/Bubble/types';
import transformProps, { formatTooltip } from '../../src/Bubble/transformProps';

const defaultFormData: SqlaFormData = {
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

const queriesData = [
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
];

const chartConfig: ChartPropsConfig = {
  formData: defaultFormData,
  height: 800,
  width: 800,
  queriesData,
  theme: supersetTheme,
};

describe('Bubble transformProps', () => {
  test('Should transform props for viz', () => {
    const chartProps = new ChartProps(chartConfig);
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

  test('Should transform props with undefined control values', () => {
    const formData: SqlaFormData = {
      ...defaultFormData,
      xAxisBounds: undefined,
      yAxisBounds: undefined,
    };
    const chartProps = new ChartProps({
      ...chartConfig,
      formData,
    });

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

describe('adhoc Custom SQL dimension', () => {
  const adhocColumn = {
    expressionType: 'SQL',
    sqlExpression: 'EXTRACT(YEAR FROM ds)',
    label: 'year',
  };
  const adhocQueriesData = [
    {
      data: [
        {
          year: 1992,
          customer_name: 'AV Stores, Co.',
          count: 10,
          'SUM(price_each)': 20,
          'SUM(sales)': 30,
        },
        {
          year: 1993,
          customer_name: 'Alpha Cognac',
          count: 40,
          'SUM(price_each)': 50,
          'SUM(sales)': 60,
        },
      ],
    },
  ];

  test('resolves the entity label so an adhoc dimension is not rendered as NULL', () => {
    const formData: SqlaFormData = { ...defaultFormData, entity: adhocColumn };
    const chartProps = new ChartProps({
      ...chartConfig,
      queriesData: adhocQueriesData,
      formData,
    });
    const result = transformProps(chartProps as EchartsBubbleChartProps);

    expect((result.echartOptions.legend as any).data).toEqual(['1992', '1993']);
    expect(result.echartOptions.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '1992',
          data: [[10, 20, 30, 1992, null]],
        }),
      ]),
    );
  });

  test('resolves the series label so an adhoc bubble series is not rendered as NULL', () => {
    const formData: SqlaFormData = {
      ...defaultFormData,
      entity: 'customer_name',
      series: adhocColumn,
    };
    const chartProps = new ChartProps({
      ...chartConfig,
      queriesData: adhocQueriesData,
      formData,
    });
    const result = transformProps(chartProps as EchartsBubbleChartProps);

    expect((result.echartOptions.legend as any).data).toEqual(['1992', '1993']);
    expect(result.echartOptions.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '1992',
          data: [[10, 20, 30, 'AV Stores, Co.', 1992]],
        }),
      ]),
    );
  });
});

describe('Bubble formatTooltip', () => {
  const dollerFormatter = getNumberFormatter('$,.2f');
  const percentFormatter = getNumberFormatter(',.1%');

  test('Should generate correct bubble label content with dimension', () => {
    const params = {
      data: [10000, 20000, 3, 'bubble title', 'bubble dimension'],
    };

    const html = formatTooltip(
      params,
      'x-axis-label',
      'y-axis-label',
      'size-label',
      dollerFormatter,
      dollerFormatter,
      percentFormatter,
    );
    expect(html).toContain('bubble title');
    expect(html).toContain('bubble dimension');
    expect(html).toContain('x-axis-label');
    expect(html).toContain('y-axis-label');
    expect(html).toContain('size-label');
    expect(html).toContain('$10,000.00');
    expect(html).toContain('$20,000.00');
    expect(html).toContain('300.0%');
  });
  test('Should generate correct bubble label content without dimension', () => {
    const params = {
      data: [10000, 25000, 3, 'bubble title', null],
    };
    const html = formatTooltip(
      params,
      'x-axis-label',
      'y-axis-label',
      'size-label',
      dollerFormatter,
      dollerFormatter,
      percentFormatter,
    );
    expect(html).toContain('bubble title');
    expect(html).not.toContain('bubble dimension');
    expect(html).toContain('x-axis-label');
    expect(html).toContain('y-axis-label');
    expect(html).toContain('size-label');
    expect(html).toContain('$10,000.00');
    expect(html).toContain('$25,000.00');
    expect(html).toContain('300.0%');
  });

  test('keeps a zero series value in the tooltip title', () => {
    const html = formatTooltip(
      { data: [1, 2, 3, 0, false] },
      'x',
      'y',
      'size',
      dollerFormatter,
      dollerFormatter,
      percentFormatter,
    );

    expect(html).toContain('false (0)');
  });
});

describe('legend sorting', () => {
  const createChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartConfig,
      formData: {
        ...defaultFormData,
        ...overrides,
      },
    });
  test('preserves original data order when no sort specified', () => {
    const props = createChartProps({ legendSort: null });
    const result = transformProps(props as EchartsBubbleChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'AV Stores, Co.',
      'Alpha Cognac',
      'Amica Models & Co.',
    ]);
  });

  test('sorts alphabetically ascending when legendSort is "asc"', () => {
    const props = createChartProps({ legendSort: 'asc' });
    const result = transformProps(props as EchartsBubbleChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'Alpha Cognac',
      'Amica Models & Co.',
      'AV Stores, Co.',
    ]);
  });

  test('sorts alphabetically descending when legendSort is "desc"', () => {
    const props = createChartProps({ legendSort: 'desc' });
    const result = transformProps(props as EchartsBubbleChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'AV Stores, Co.',
      'Amica Models & Co.',
      'Alpha Cognac',
    ]);
  });
});

describe('Bubble cross-filter selection', () => {
  test('dims bubbles that are not part of the active cross-filter', () => {
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: { ...defaultFormData, opacity: 0.6 },
      filterState: { selectedValues: ['["Alpha Cognac"]'] },
      emitCrossFilters: true,
    });
    const result = transformProps(
      chartProps as unknown as EchartsBubbleChartProps,
    );
    const series = result.echartOptions.series as {
      name: string;
      cursor: string;
      itemStyle: { opacity: number };
    }[];

    expect(
      series.find(item => item.name === 'Alpha Cognac')?.itemStyle.opacity,
    ).toBe(0.6);
    expect(
      series.find(item => item.name === 'AV Stores, Co.')?.itemStyle.opacity,
    ).toBe(0.6 * 0.3);
    expect(series.every(item => item.cursor === 'pointer')).toBe(true);
  });

  test('dims bubbles by entity and series when a series dimension is set', () => {
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: {
        ...defaultFormData,
        series: 'status',
        opacity: 1,
      },
      queriesData: [
        {
          data: [
            {
              customer_name: 'AV Stores, Co.',
              status: 'open',
              count: 10,
              'SUM(price_each)': 20,
              'SUM(sales)': 30,
            },
            {
              customer_name: 'AV Stores, Co.',
              status: 'closed',
              count: 40,
              'SUM(price_each)': 50,
              'SUM(sales)': 60,
            },
          ],
        },
      ],
      filterState: {
        selectedValues: ['["AV Stores, Co.","open"]'],
      },
    });
    const result = transformProps(
      chartProps as unknown as EchartsBubbleChartProps,
    );
    const series = result.echartOptions.series as {
      data: unknown[][];
      itemStyle: { opacity: number };
    }[];
    const openBubble = series.find(item => item.data[0][4] === 'open');
    const closedBubble = series.find(item => item.data[0][4] === 'closed');

    expect(openBubble?.itemStyle.opacity).toBe(1);
    expect(closedBubble?.itemStyle.opacity).toBe(0.3);
  });

  test('uses the default cursor when cross-filtering is disabled', () => {
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: { ...defaultFormData, opacity: 0.6 },
      filterState: { selectedValues: ['["Alpha Cognac"]'] },
      emitCrossFilters: false,
    });
    const result = transformProps(
      chartProps as unknown as EchartsBubbleChartProps,
    );
    const series = result.echartOptions.series as { cursor: string }[];

    expect(series.every(item => item.cursor === 'default')).toBe(true);
  });

  test('keeps numeric zero and false entity values in the series name', () => {
    const chartProps = new ChartProps({
      ...chartConfig,
      queriesData: [
        {
          data: [
            {
              customer_name: 0,
              count: 10,
              'SUM(price_each)': 20,
              'SUM(sales)': 30,
            },
            {
              customer_name: false,
              count: 40,
              'SUM(price_each)': 50,
              'SUM(sales)': 60,
            },
          ],
        },
      ],
    });
    const result = transformProps(
      chartProps as unknown as EchartsBubbleChartProps,
    );
    const names = (result.echartOptions.series as { name: string }[]).map(
      item => item.name,
    );

    expect(names).toEqual(['0', 'false']);
  });
});
