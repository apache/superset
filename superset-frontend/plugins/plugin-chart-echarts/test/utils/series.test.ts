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
  dedupSeries,
  extractGroupbyLabel,
  extractSeries,
  formatSeriesName,
  getChartPadding,
  getLegendProps,
  sanitizeHtml,
} from '../../src/utils/series';
import { LegendOrientation, LegendType } from '../../src/types';
import { defaultLegendPadding } from '../../src/defaults';
import { NULL_STRING } from '../../src/constants';

describe('extractSeries', () => {
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
    expect(extractSeries(data)).toEqual([
      {
        id: 'Hulk',
        name: 'Hulk',
        data: [
          ['2000-01-01', null],
          ['2000-02-01', 2],
          ['2000-03-01', 1],
        ],
      },
      {
        id: 'abc',
        name: 'abc',
        data: [
          ['2000-01-01', 2],
          ['2000-02-01', 10],
          ['2000-03-01', 5],
        ],
      },
    ]);
  });

  it('should remove rows that have a null x-value', () => {
    const data = [
      {
        x: 1,
        Hulk: null,
        abc: 2,
      },
      {
        x: null,
        Hulk: 2,
        abc: 10,
      },
      {
        x: 2,
        Hulk: 1,
        abc: 5,
      },
    ];
    expect(extractSeries(data, { xAxis: 'x', removeNulls: true })).toEqual([
      {
        id: 'Hulk',
        name: 'Hulk',
        data: [[2, 1]],
      },
      {
        id: 'abc',
        name: 'abc',
        data: [
          [1, 2],
          [2, 5],
        ],
      },
    ]);
  });

  it('should do missing value imputation', () => {
    const data = [
      {
        __timestamp: '2000-01-01',
        abc: null,
      },
      {
        __timestamp: '2000-02-01',
        abc: null,
      },
      {
        __timestamp: '2000-03-01',
        abc: 1,
      },
      {
        __timestamp: '2000-04-01',
        abc: null,
      },
      {
        __timestamp: '2000-05-01',
        abc: null,
      },
      {
        __timestamp: '2000-06-01',
        abc: null,
      },
      {
        __timestamp: '2000-07-01',
        abc: 2,
      },
      {
        __timestamp: '2000-08-01',
        abc: 3,
      },
      {
        __timestamp: '2000-09-01',
        abc: null,
      },
      {
        __timestamp: '2000-10-01',
        abc: null,
      },
    ];
    expect(extractSeries(data, { fillNeighborValue: 0 })).toEqual([
      {
        id: 'abc',
        name: 'abc',
        data: [
          ['2000-01-01', null],
          ['2000-02-01', 0],
          ['2000-03-01', 1],
          ['2000-04-01', 0],
          ['2000-05-01', null],
          ['2000-06-01', 0],
          ['2000-07-01', 2],
          ['2000-08-01', 3],
          ['2000-09-01', 0],
          ['2000-10-01', null],
        ],
      },
    ]);
  });
});

describe('extractGroupbyLabel', () => {
  it('should join together multiple groupby labels', () => {
    expect(
      extractGroupbyLabel({
        datum: { a: 'abc', b: 'qwerty' },
        groupby: ['a', 'b'],
      }),
    ).toEqual('abc, qwerty');
  });

  it('should handle a single groupby', () => {
    expect(
      extractGroupbyLabel({ datum: { xyz: 'qqq' }, groupby: ['xyz'] }),
    ).toEqual('qqq');
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
    expect(formatSeriesName(new Date('2020-09-11'))).toEqual(
      '2020-09-11T00:00:00.000Z',
    );
  });

  it('should use timeFormatter for date values when formatter is provided', () => {
    expect(formatSeriesName(new Date('2020-09-11'), { timeFormatter })).toEqual(
      '2020-09-11 00:00:00',
    );
  });

  describe('getLegendProps', () => {
    it('should return the correct props for scroll type with top orientation without zoom', () => {
      expect(
        getLegendProps(LegendType.Scroll, LegendOrientation.Top, true, false),
      ).toEqual({
        show: true,
        top: 0,
        right: 0,
        orient: 'horizontal',
        type: 'scroll',
      });
    });

    it('should return the correct props for scroll type with top orientation with zoom', () => {
      expect(
        getLegendProps(LegendType.Scroll, LegendOrientation.Top, true, true),
      ).toEqual({
        show: true,
        top: 0,
        right: 55,
        orient: 'horizontal',
        type: 'scroll',
      });
    });

    it('should return the correct props for plain type with left orientation', () => {
      expect(
        getLegendProps(LegendType.Plain, LegendOrientation.Left, true),
      ).toEqual({
        show: true,
        left: 0,
        orient: 'vertical',
        type: 'plain',
      });
    });

    it('should return the correct props for plain type with right orientation without zoom', () => {
      expect(
        getLegendProps(LegendType.Plain, LegendOrientation.Right, false, false),
      ).toEqual({
        show: false,
        right: 0,
        top: 0,
        orient: 'vertical',
        type: 'plain',
      });
    });

    it('should return the correct props for plain type with right orientation with zoom', () => {
      expect(
        getLegendProps(LegendType.Plain, LegendOrientation.Right, false, true),
      ).toEqual({
        show: false,
        right: 0,
        top: 30,
        orient: 'vertical',
        type: 'plain',
      });
    });

    it('should return the correct props for plain type with bottom orientation', () => {
      expect(
        getLegendProps(LegendType.Plain, LegendOrientation.Bottom, false),
      ).toEqual({
        show: false,
        bottom: 0,
        orient: 'horizontal',
        type: 'plain',
      });
    });
  });

  describe('getChartPadding', () => {
    it('should handle top default', () => {
      expect(getChartPadding(true, LegendOrientation.Top)).toEqual({
        bottom: 0,
        left: 0,
        right: 0,
        top: defaultLegendPadding[LegendOrientation.Top],
      });
    });

    it('should handle left default', () => {
      expect(getChartPadding(true, LegendOrientation.Left)).toEqual({
        bottom: 0,
        left: defaultLegendPadding[LegendOrientation.Left],
        right: 0,
        top: 0,
      });
    });

    it('should return the default padding when show is false', () => {
      expect(
        getChartPadding(false, LegendOrientation.Left, 100, {
          top: 10,
          bottom: 20,
          left: 30,
          right: 40,
        }),
      ).toEqual({
        bottom: 20,
        left: 30,
        right: 40,
        top: 10,
      });
    });

    it('should return the correct padding for left orientation', () => {
      expect(getChartPadding(true, LegendOrientation.Left, 100)).toEqual({
        bottom: 0,
        left: 100,
        right: 0,
        top: 0,
      });
    });

    it('should return the correct padding for right orientation', () => {
      expect(getChartPadding(true, LegendOrientation.Right, 50)).toEqual({
        bottom: 0,
        left: 0,
        right: 50,
        top: 0,
      });
    });

    it('should return the correct padding for top orientation', () => {
      expect(getChartPadding(true, LegendOrientation.Top, 20)).toEqual({
        bottom: 0,
        left: 0,
        right: 0,
        top: 20,
      });
    });

    it('should return the correct padding for bottom orientation', () => {
      expect(getChartPadding(true, LegendOrientation.Bottom, 10)).toEqual({
        bottom: 10,
        left: 0,
        right: 0,
        top: 0,
      });
    });
  });

  describe('dedupSeries', () => {
    it('should deduplicate ids in series', () => {
      expect(
        dedupSeries([
          {
            id: 'foo',
          },
          {
            id: 'bar',
          },
          {
            id: 'foo',
          },
          {
            id: 'foo',
          },
        ]),
      ).toEqual([
        { id: 'foo' },
        { id: 'bar' },
        { id: 'foo (1)' },
        { id: 'foo (2)' },
      ]);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove html tags from series name', () => {
      expect(sanitizeHtml(NULL_STRING)).toEqual('&lt;NULL&gt;');
    });
  });
});
