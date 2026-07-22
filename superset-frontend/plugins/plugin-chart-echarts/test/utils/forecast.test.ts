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
import { getNumberFormatter, NumberFormats } from '@superset-ui/core';
import { SeriesOption } from 'echarts';
import {
  extractForecastSeriesContext,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
  reorderForecastSeries,
} from '../../src/utils/forecast';
import { ForecastSeriesEnum } from '../../src/types';

describe('extractForecastSeriesContext', () => {
  test('should extract the correct series name and type', () => {
    expect(extractForecastSeriesContext('abcd')).toEqual({
      name: 'abcd',
      type: ForecastSeriesEnum.Observation,
    });
    expect(extractForecastSeriesContext('qwerty__yhat')).toEqual({
      name: 'qwerty',
      type: ForecastSeriesEnum.ForecastTrend,
    });
    expect(extractForecastSeriesContext('X Y Z___yhat_upper')).toEqual({
      name: 'X Y Z_',
      type: ForecastSeriesEnum.ForecastUpper,
    });
    expect(extractForecastSeriesContext('1 2 3__yhat_lower')).toEqual({
      name: '1 2 3',
      type: ForecastSeriesEnum.ForecastLower,
    });
  });
});

describe('reorderForecastSeries', () => {
  test('should reorder the forecast series and preserve values', () => {
    const input: SeriesOption[] = [
      { id: `series${ForecastSeriesEnum.Observation}`, data: [10, 20, 30] },
      { id: `series${ForecastSeriesEnum.ForecastTrend}`, data: [15, 25, 35] },
      { id: `series${ForecastSeriesEnum.ForecastLower}`, data: [5, 15, 25] },
      { id: `series${ForecastSeriesEnum.ForecastUpper}`, data: [25, 35, 45] },
    ];
    const expectedOutput: SeriesOption[] = [
      { id: `series${ForecastSeriesEnum.ForecastLower}`, data: [5, 15, 25] },
      { id: `series${ForecastSeriesEnum.ForecastUpper}`, data: [25, 35, 45] },
      { id: `series${ForecastSeriesEnum.ForecastTrend}`, data: [15, 25, 35] },
      { id: `series${ForecastSeriesEnum.Observation}`, data: [10, 20, 30] },
    ];
    expect(reorderForecastSeries(input)).toEqual(expectedOutput);
  });

  test('should handle an empty array', () => {
    expect(reorderForecastSeries([])).toEqual([]);
  });

  test('should not reorder if no relevant series are present', () => {
    const input: SeriesOption[] = [{ id: 'some-other-series' }];
    expect(reorderForecastSeries(input)).toEqual(input);
  });

  test('should handle undefined ids', () => {
    const input: SeriesOption[] = [
      { id: `series${ForecastSeriesEnum.ForecastLower}` },
      { id: undefined },
      { id: `series${ForecastSeriesEnum.ForecastTrend}` },
    ];
    const expectedOutput: SeriesOption[] = [
      { id: `series${ForecastSeriesEnum.ForecastLower}` },
      { id: `series${ForecastSeriesEnum.ForecastTrend}` },
      { id: undefined },
    ];
    expect(reorderForecastSeries(input)).toEqual(expectedOutput);
  });
});

describe('rebaseForecastDatum', () => {
  test('should subtract lower confidence level from upper value', () => {
    expect(
      rebaseForecastDatum([
        {
          __timestamp: new Date('2001-01-01'),
          abc: 10,
          abc__yhat_lower: 1,
          abc__yhat_upper: 20,
        },
        {
          __timestamp: new Date('2001-01-01'),
          abc: 10,
          abc__yhat_lower: -10,
          abc__yhat_upper: 20,
        },
        {
          __timestamp: new Date('2002-01-01'),
          abc: 10,
          abc__yhat_lower: null,
          abc__yhat_upper: 20,
        },
        {
          __timestamp: new Date('2003-01-01'),
          abc: 10,
          abc__yhat_lower: 1,
          abc__yhat_upper: null,
        },
      ]),
    ).toEqual([
      {
        __timestamp: new Date('2001-01-01'),
        abc: 10,
        abc__yhat_lower: 1,
        abc__yhat_upper: 19,
      },
      {
        __timestamp: new Date('2001-01-01'),
        abc: 10,
        abc__yhat_lower: -10,
        abc__yhat_upper: 30,
      },
      {
        __timestamp: new Date('2002-01-01'),
        abc: 10,
        abc__yhat_lower: null,
        abc__yhat_upper: 20,
      },
      {
        __timestamp: new Date('2003-01-01'),
        abc: 10,
        abc__yhat_lower: 1,
        abc__yhat_upper: null,
      },
    ]);
  });

  test('should rename all series based on verboseMap but leave __timestamp alone', () => {
    expect(
      rebaseForecastDatum(
        [
          {
            __timestamp: new Date('2001-01-01'),
            abc: 10,
            abc__yhat_lower: 1,
            abc__yhat_upper: 20,
          },
          {
            __timestamp: new Date('2002-01-01'),
            abc: 10,
            abc__yhat_lower: null,
            abc__yhat_upper: 20,
          },
          {
            __timestamp: new Date('2003-01-01'),
            abc: 10,
            abc__yhat_lower: 1,
            abc__yhat_upper: null,
          },
        ],
        {
          abc: 'Abracadabra',
          __timestamp: 'Time',
        },
      ),
    ).toEqual([
      {
        __timestamp: new Date('2001-01-01'),
        Abracadabra: 10,
        Abracadabra__yhat_lower: 1,
        Abracadabra__yhat_upper: 19,
      },
      {
        __timestamp: new Date('2002-01-01'),
        Abracadabra: 10,
        Abracadabra__yhat_lower: null,
        Abracadabra__yhat_upper: 20,
      },
      {
        __timestamp: new Date('2003-01-01'),
        Abracadabra: 10,
        Abracadabra__yhat_lower: 1,
        Abracadabra__yhat_upper: null,
      },
    ]);
  });
});

test('extractForecastValuesFromTooltipParams should extract the proper data from tooltip params', () => {
  expect(
    extractForecastValuesFromTooltipParams([
      {
        marker: '<img>',
        seriesId: 'abc',
        value: [new Date(0), 10],
      },
      {
        marker: '<img>',
        seriesId: 'abc__yhat',
        value: [new Date(0), 1],
      },
      {
        marker: '<img>',
        seriesId: 'abc__yhat_lower',
        value: [new Date(0), 5],
      },
      {
        marker: '<img>',
        seriesId: 'abc__yhat_upper',
        value: [new Date(0), 6],
      },
      {
        marker: '<img>',
        seriesId: 'qwerty',
        value: [new Date(0), 2],
      },
    ]),
  ).toEqual({
    abc: {
      marker: '<img>',
      observation: 10,
      forecastTrend: 1,
      forecastLower: 5,
      forecastUpper: 6,
    },
    qwerty: {
      marker: '<img>',
      observation: 2,
    },
  });
});

test('extractForecastValuesFromTooltipParams should extract valid values', () => {
  expect(
    extractForecastValuesFromTooltipParams([
      {
        marker: '<img>',
        seriesId: 'foo',
        value: [0, 10],
      },
      {
        marker: '<img>',
        seriesId: 'bar',
        value: [100, 0],
      },
    ]),
  ).toEqual({
    foo: {
      marker: '<img>',
      observation: 10,
    },
    bar: {
      marker: '<img>',
      observation: 0,
    },
  });
});

// Regression (H3/sc-114915): all-null or empty series can hand the tooltip a
// bare null/undefined `value` instead of a [x, y] tuple. Indexing it threw
// "Cannot read properties of null (reading '1')" and killed the render.
test('extractForecastValuesFromTooltipParams tolerates null/undefined values', () => {
  expect(() =>
    extractForecastValuesFromTooltipParams([
      { marker: '<img>', seriesId: 'nullish', value: null },
      { marker: '<img>', seriesId: 'undef', value: undefined },
      { marker: '<img>', seriesId: 'ok', value: [0, 10] },
    ]),
  ).not.toThrow();
  expect(
    extractForecastValuesFromTooltipParams([
      { marker: '<img>', seriesId: 'nullish', value: null },
      { marker: '<img>', seriesId: 'ok', value: [0, 10] },
    ]),
  ).toEqual({
    ok: {
      marker: '<img>',
      observation: 10,
    },
  });
});

const formatter = getNumberFormatter(NumberFormats.INTEGER);

test('formatForecastTooltipSeries should apply format to value', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'abc',
      marker: '<img>',
      observation: 10.1,
      formatter,
    }),
  ).toEqual(['<img>abc', '10']);
});

test('formatForecastTooltipSeries should show falsy value', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'abc',
      marker: '<img>',
      observation: 0,
      formatter,
    }),
  ).toEqual(['<img>abc', '0']);
});

test('formatForecastTooltipSeries should format full forecast', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10.1,
      forecastTrend: 20.1,
      forecastLower: 5.1,
      forecastUpper: 7.1,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10, ŷ = 20 (5, 12)']);
});

test('formatForecastTooltipSeries should format forecast without observation', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      forecastTrend: 20,
      forecastLower: 5,
      forecastUpper: 7,
      formatter,
    }),
  ).toEqual(['<img>qwerty', 'ŷ = 20 (5, 12)']);
});

test('formatForecastTooltipSeries should format forecast without point estimate', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10.1,
      forecastLower: 6,
      forecastUpper: 7,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10 (6, 13)']);
});

test('formatForecastTooltipSeries should format forecast with only confidence band', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      forecastLower: 7,
      forecastUpper: 8,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '(7, 15)']);
});

test('formatForecastTooltipSeries should show forecast trend equal to zero', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10,
      forecastTrend: 0,
      forecastLower: 5,
      forecastUpper: 7,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10, ŷ = 0 (5, 12)']);
});

test('formatForecastTooltipSeries should show confidence band when lower bound is zero', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10,
      forecastTrend: 5,
      forecastLower: 0,
      forecastUpper: 7,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10, ŷ = 5 (0, 7)']);
});

test('formatForecastTooltipSeries should show confidence band when band height is zero', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10,
      forecastTrend: 5,
      forecastLower: 4,
      forecastUpper: 0,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10, ŷ = 5 (4, 4)']);
});

test('formatForecastTooltipSeries should show forecast trend and band all at zero', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      forecastTrend: 0,
      forecastLower: 0,
      forecastUpper: 0,
      formatter,
    }),
  ).toEqual(['<img>qwerty', 'ŷ = 0 (0, 0)']);
});

test('formatForecastTooltipSeries should skip non-finite forecast values', () => {
  expect(
    formatForecastTooltipSeries({
      seriesName: 'qwerty',
      marker: '<img>',
      observation: 10,
      forecastTrend: NaN,
      forecastLower: Infinity,
      forecastUpper: -Infinity,
      formatter,
    }),
  ).toEqual(['<img>qwerty', '10']);
});
