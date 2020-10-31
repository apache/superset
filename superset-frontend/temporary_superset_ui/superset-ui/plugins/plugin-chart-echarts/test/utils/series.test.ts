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
import { getNumberFormatter, getTimeFormatter } from '@superset-ui/core';
import {
  extractGroupbyLabel,
  extractTimeseriesSeries,
  formatSeriesName,
} from '../../src/utils/series';

describe('extractTimeseriesSeries', () => {
  it('should generate a valid ECharts timeseries series object', () => {
    const data = [
      {
        __timestamp: '2000-01-01',
        Hulk: null,
        abc: 2,
      },
      {
        __timestamp: '2000-02-01',
        Hulk: 2,
        abc: 10,
      },
      {
        __timestamp: '2000-03-01',
        Hulk: 1,
        abc: 5,
      },
    ];
    expect(extractTimeseriesSeries(data)).toEqual([
      {
        name: 'Hulk',
        data: [
          [new Date('2000-01-01'), null],
          [new Date('2000-02-01'), 2],
          [new Date('2000-03-01'), 1],
        ],
      },
      {
        name: 'abc',
        data: [
          [new Date('2000-01-01'), 2],
          [new Date('2000-02-01'), 10],
          [new Date('2000-03-01'), 5],
        ],
      },
    ]);
  });
});

describe('extractGroupbyLabel', () => {
  it('should join together multiple groupby labels', () => {
    expect(extractGroupbyLabel({ datum: { a: 'abc', b: 'qwerty' }, groupby: ['a', 'b'] })).toEqual(
      'abc, qwerty',
    );
  });

  it('should handle a single groupby', () => {
    expect(extractGroupbyLabel({ datum: { xyz: 'qqq' }, groupby: ['xyz'] })).toEqual('qqq');
  });

  it('should handle mixed types', () => {
    expect(
      extractGroupbyLabel({
        datum: { strcol: 'abc', intcol: 123, floatcol: 0.123, boolcol: true },
        groupby: ['strcol', 'intcol', 'floatcol', 'boolcol'],
      }),
    ).toEqual('abc, 123, 0.123, true');
  });

  it('should handle null and undefined groupby', () => {
    expect(
      extractGroupbyLabel({
        datum: { strcol: 'abc', intcol: 123, floatcol: 0.123, boolcol: true },
        groupby: null,
      }),
    ).toEqual('');
    expect(extractGroupbyLabel({})).toEqual('');
  });
});

describe('formatSeriesName', () => {
  const numberFormatter = getNumberFormatter();
  const timeFormatter = getTimeFormatter();
  it('should handle missing values properly', () => {
    expect(formatSeriesName(undefined)).toEqual('<NULL>');
    expect(formatSeriesName(null)).toEqual('<NULL>');
  });

  it('should handle string values properly', () => {
    expect(formatSeriesName('abc XYZ!')).toEqual('abc XYZ!');
  });

  it('should handle boolean values properly', () => {
    expect(formatSeriesName(true)).toEqual('true');
  });

  it('should use default formatting for numeric values without formatter', () => {
    expect(formatSeriesName(12345678.9)).toEqual('12345678.9');
  });

  it('should use numberFormatter for numeric values when formatter is provided', () => {
    expect(formatSeriesName(12345678.9, { numberFormatter })).toEqual('12.3M');
  });

  it('should use default formatting for for date values without formatter', () => {
    expect(formatSeriesName(new Date('2020-09-11'))).toEqual('2020-09-11T00:00:00.000Z');
  });

  it('should use timeFormatter for date values when formatter is provided', () => {
    expect(formatSeriesName(new Date('2020-09-11'), { timeFormatter })).toEqual(
      '2020-09-11 00:00:00',
    );
  });
});
