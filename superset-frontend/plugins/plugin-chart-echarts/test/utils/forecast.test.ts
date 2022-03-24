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
import {
  extractForecastSeriesContext,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
} from '../../src/utils/forecast';
import { ForecastSeriesEnum } from '../../src/types';

describe('extractForecastSeriesContext', () => {
  it('should extract the correct series name and type', () => {
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

describe('rebaseForecastDatum', () => {
  it('should subtract lower confidence level from upper value', () => {
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

  it('should rename all series based on verboseMap but leave __timestamp alone', () => {
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

describe('extractForecastValuesFromTooltipParams', () => {
  it('should extract the proper data from tooltip params', () => {
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
});

const formatter = getNumberFormatter(NumberFormats.INTEGER);

describe('formatForecastTooltipSeries', () => {
  it('should generate a proper series tooltip', () => {
    expect(
      formatForecastTooltipSeries({
        seriesName: 'abc',
        marker: '<img>',
        observation: 10.1,
        formatter,
      }),
    ).toEqual('<img>abc: 10');
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
    ).toEqual('<img>qwerty: 10, ŷ = 20 (5, 12)');
    expect(
      formatForecastTooltipSeries({
        seriesName: 'qwerty',
        marker: '<img>',
        forecastTrend: 20,
        forecastLower: 5,
        forecastUpper: 7,
        formatter,
      }),
    ).toEqual('<img>qwerty: ŷ = 20 (5, 12)');
    expect(
      formatForecastTooltipSeries({
        seriesName: 'qwerty',
        marker: '<img>',
        observation: 10.1,
        forecastLower: 6,
        forecastUpper: 7,
        formatter,
      }),
    ).toEqual('<img>qwerty: 10 (6, 13)');
    expect(
      formatForecastTooltipSeries({
        seriesName: 'qwerty',
        marker: '<img>',
        forecastLower: 7,
        forecastUpper: 8,
        formatter,
      }),
    ).toEqual('<img>qwerty: (7, 15)');
  });
});
