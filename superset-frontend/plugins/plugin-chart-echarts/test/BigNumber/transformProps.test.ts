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
  DatasourceType,
  supersetTheme,
  TimeGranularity,
  VizType,
} from '@superset-ui/core';
import transformProps from '../../src/BigNumber/BigNumberWithTrendline/transformProps';
import {
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  BigNumberWithTrendlineFormData,
} from '../../src/BigNumber/types';

const formData = {
  metric: 'value',
  colorPicker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compareLag: 1,
  timeGrainSqla: TimeGranularity.QUARTER,
  granularitySqla: 'ds',
  compareSuffix: 'over last quarter',
  viz_type: VizType.BigNumber,
  yAxisFormat: '.3s',
  datasource: 'test_datasource',
};

const rawFormData: BigNumberWithTrendlineFormData = {
  colorPicker: { b: 0, g: 0, r: 0 },
  datasource: '1__table',
  metric: 'value',
  color_picker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compare_lag: 1,
  time_grain_sqla: TimeGranularity.QUARTER,
  granularity_sqla: 'ds',
  compare_suffix: 'over last quarter',
  viz_type: VizType.BigNumber,
  y_axis_format: '.3s',
};

function generateProps(
  data: BigNumberDatum[],
  extraFormData = {},
  extraQueryData: any = {},
): BigNumberWithTrendlineChartProps {
  return {
    width: 200,
    height: 500,
    annotationData: {},
    datasource: {
      id: 0,
      name: '',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
      columnFormats: {},
      verboseMap: {},
    },
    rawDatasource: {},
    rawFormData,
    hooks: {},
    initialValues: {},
    formData: {
      ...formData,
      ...extraFormData,
    },
    queriesData: [
      {
        data,
        ...extraQueryData,
      },
    ],
    ownState: {},
    filterState: {},
    behaviors: [],
    theme: supersetTheme,
  };
}

describe('BigNumberWithTrendline', () => {
  const props = generateProps(
    [
      {
        __timestamp: 0,
        value: 1.2345,
      },
      {
        __timestamp: 100,
        value: null,
      },
    ],
    { showTrendLine: true },
  );

  describe('transformProps()', () => {
    it('should fallback and format time', () => {
      const transformed = transformProps(props);
      // the first item is the last item sorted by __timestamp
      const lastDatum = transformed.trendLineData?.pop();

      // should use last available value
      expect(lastDatum?.[0]).toStrictEqual(100);
      expect(lastDatum?.[1]).toBeNull();

      // should get the last non-null value
      expect(transformed.bigNumber).toStrictEqual(1.2345);
      // bigNumberFallback is only set when bigNumber is null after aggregation
      expect(transformed.bigNumberFallback).toBeNull();

      // should successfully formatTime by granularity
      // @ts-ignore
      expect(transformed.formatTime(new Date('2020-01-01'))).toStrictEqual(
        '2020-01-01 00:00:00',
      );
    });

    it('should respect datasource d3 format', () => {
      const propsWithDatasource = {
        ...props,
        datasource: {
          ...props.datasource,
          metrics: [
            {
              label: 'value',
              metric_name: 'value',
              d3format: '.2f',
              uuid: '1',
            },
          ],
        },
      };
      const transformed = transformProps(propsWithDatasource);
      // @ts-ignore
      expect(transformed.headerFormatter(transformed.bigNumber)).toStrictEqual(
        '1.23',
      );
    });

    it('should format with datasource currency', () => {
      const propsWithDatasource = {
        ...props,
        datasource: {
          ...props.datasource,
          currencyFormats: {
            value: { symbol: 'USD', symbolPosition: 'prefix' },
          },
          metrics: [
            {
              label: 'value',
              metric_name: 'value',
              d3format: '.2f',
              currency: { symbol: 'USD', symbolPosition: 'prefix' },
              uuid: '1',
            },
          ],
        },
      };
      const transformed = transformProps(propsWithDatasource);
      // @ts-ignore
      expect(transformed.headerFormatter(transformed.bigNumber)).toStrictEqual(
        '$ 1.23',
      );
    });
  });
});

describe('BigNumberWithTrendline - Aggregation Tests', () => {
  const baseProps = {
    width: 800,
    height: 600,
    formData: {
      colorPicker: { r: 0, g: 0, b: 0, a: 1 },
      metric: 'metric',
      aggregation: 'LAST_VALUE',
    },
    queriesData: [
      {
        data: [
          { __timestamp: 1607558400000, metric: 10 },
          { __timestamp: 1607558500000, metric: 30 },
          { __timestamp: 1607558600000, metric: 50 },
          { __timestamp: 1607558700000, metric: 60 },
        ],
        colnames: ['__timestamp', 'metric'],
        coltypes: ['TIMESTAMP', 'BIGINT'],
      },
    ],
    hooks: {},
    filterState: {},
    datasource: {
      columnFormats: {},
      currencyFormats: {},
    },
    rawDatasource: {},
    rawFormData: {},
    theme: {
      colors: {
        grayscale: {
          light5: '#fafafa',
        },
      },
    },
  } as unknown as BigNumberWithTrendlineChartProps;

  const propsWithEvenData = {
    ...baseProps,
    queriesData: [
      {
        data: [
          { __timestamp: 1607558400000, metric: 10 },
          { __timestamp: 1607558500000, metric: 20 },
          { __timestamp: 1607558600000, metric: 30 },
          { __timestamp: 1607558700000, metric: 40 },
        ],
        colnames: ['__timestamp', 'metric'],
        coltypes: ['TIMESTAMP', 'BIGINT'],
      },
    ],
  } as unknown as BigNumberWithTrendlineChartProps;

  it('should correctly calculate SUM', () => {
    const props = {
      ...baseProps,
      formData: { ...baseProps.formData, aggregation: 'sum' },
      queriesData: [
        baseProps.queriesData[0],
        {
          data: [{ metric: 150 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(150);
  });

  it('should correctly calculate AVG', () => {
    const props = {
      ...baseProps,
      formData: { ...baseProps.formData, aggregation: 'mean' },
      queriesData: [
        baseProps.queriesData[0],
        {
          data: [{ metric: 37.5 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(37.5);
  });

  it('should correctly calculate MIN', () => {
    const props = {
      ...baseProps,
      formData: { ...baseProps.formData, aggregation: 'min' },
      queriesData: [
        baseProps.queriesData[0],
        {
          data: [{ metric: 10 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(10);
  });

  it('should correctly calculate MAX', () => {
    const props = {
      ...baseProps,
      formData: { ...baseProps.formData, aggregation: 'max' },
      queriesData: [
        baseProps.queriesData[0],
        {
          data: [{ metric: 60 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(60);
  });

  it('should correctly calculate MEDIAN (odd count)', () => {
    const oddCountProps = {
      ...baseProps,
      queriesData: [
        {
          data: [
            { __timestamp: 1607558300000, metric: 10 },
            { __timestamp: 1607558400000, metric: 20 },
            { __timestamp: 1607558500000, metric: 30 },
            { __timestamp: 1607558600000, metric: 40 },
            { __timestamp: 1607558700000, metric: 50 },
          ],
          colnames: ['__timestamp', 'metric'],
          coltypes: ['TIMESTAMP', 'BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const props = {
      ...oddCountProps,
      formData: { ...oddCountProps.formData, aggregation: 'median' },
      queriesData: [
        oddCountProps.queriesData[0],
        {
          data: [{ metric: 30 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(30);
  });

  it('should correctly calculate MEDIAN (even count)', () => {
    const props = {
      ...propsWithEvenData,
      formData: { ...propsWithEvenData.formData, aggregation: 'median' },
      queriesData: [
        propsWithEvenData.queriesData[0],
        {
          data: [{ metric: 25 }],
          colnames: ['metric'],
          coltypes: ['BIGINT'],
        },
      ],
    } as unknown as BigNumberWithTrendlineChartProps;

    const transformed = transformProps(props);
    expect(transformed.bigNumber).toStrictEqual(25);
  });

  it('should return the LAST_VALUE correctly', () => {
    const transformed = transformProps(baseProps);
    expect(transformed.bigNumber).toStrictEqual(10);
  });
});
