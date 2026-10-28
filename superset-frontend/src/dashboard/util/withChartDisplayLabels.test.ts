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
import type { Datasource } from 'src/dashboard/types';
import { withChartDisplayLabels } from './withChartDisplayLabels';

type LabelDatasource = Partial<
  Pick<Datasource, 'chart_display_labels' | 'verbose_map'>
>;

test('adds only the requested chart labels without mutating the shared datasource', () => {
  const labels = Object.freeze({ country_name: 'Country', sum__num: 'Total' });
  const datasource: LabelDatasource = Object.freeze({
    chart_display_labels: Object.freeze({
      '12': labels,
      '13': Object.freeze({ private_column: 'Other chart' }),
    }),
  });

  const result = withChartDisplayLabels(datasource, 12);

  expect(result).not.toBe(datasource);
  expect(result.verbose_map).toEqual(labels);
  expect(result.chart_display_labels).toBe(datasource.chart_display_labels);
  expect(datasource.verbose_map).toBeUndefined();
  expect(withChartDisplayLabels(datasource, '13').verbose_map).toEqual({
    private_column: 'Other chart',
  });
});

test('preserves dataset labels and returns the same reference when they cover chart labels', () => {
  const datasource = {
    verbose_map: Object.freeze({ country_name: 'Dataset country' }),
    chart_display_labels: { '12': { country_name: 'Chart country' } },
  };

  expect(withChartDisplayLabels(datasource, 12)).toBe(datasource);
  const extended = {
    ...datasource,
    chart_display_labels: {
      '12': { country_name: 'Chart country', sum__num: 'Total' },
    },
  };
  expect(withChartDisplayLabels(extended, 12).verbose_map).toEqual({
    country_name: 'Dataset country',
    sum__num: 'Total',
  });
});

test.each<LabelDatasource['chart_display_labels']>([
  undefined,
  {},
  { '13': { country_name: 'Country' } },
  { '12': {} },
])(
  'keeps the datasource reference when no labels apply: %j',
  chartDisplayLabels => {
    const datasource = { chart_display_labels: chartDisplayLabels };
    expect(withChartDisplayLabels(datasource, 12)).toBe(datasource);
  },
);

test('ignores blank and non-string labels while preserving nonblank strings exactly', () => {
  const datasource = {
    chart_display_labels: {
      '12': {
        country_name: ' Country ',
        empty: '',
        whitespace: '  \t',
        number: 123,
        null: null,
        object: {},
      },
    },
  } as unknown as LabelDatasource;

  expect(withChartDisplayLabels(datasource, 12).verbose_map).toEqual({
    country_name: ' Country ',
  });
});

test.each([null, 'Country', ['Country'], { blank: ' ' }, { number: 123 }])(
  'ignores unusable chart entries and retains identity: %j',
  labels => {
    const datasource = {
      chart_display_labels: { '12': labels },
    } as unknown as LabelDatasource;
    expect(withChartDisplayLabels(datasource, 12)).toBe(datasource);
  },
);

test('does not use inherited chart entries or inherited raw labels', () => {
  const inheritedChart: Record<string, Record<string, string>> = Object.create({
    '12': { country_name: 'Country' },
  });
  const datasource = { chart_display_labels: inheritedChart };
  expect(withChartDisplayLabels(datasource, 12)).toBe(datasource);

  const inheritedLabel: Record<string, string> = Object.create({
    hidden: 'Inherited',
  });
  inheritedLabel.country_name = 'Country';
  const ownDatasource: LabelDatasource = {
    chart_display_labels: { '12': inheritedLabel },
  };
  expect(withChartDisplayLabels(ownDatasource, 12).verbose_map).toEqual({
    country_name: 'Country',
  });
});

test.each(['__proto__', 'constructor'])(
  'ignores the reserved chart ID %s even when it is an own property',
  chartId => {
    const datasource = {
      chart_display_labels: { [chartId]: { country_name: 'Country' } },
    };
    expect(withChartDisplayLabels(datasource, chartId)).toBe(datasource);
  },
);

test('preserves punctuation and prototype-like raw field IDs as own data properties', () => {
  const labels = {
    sum__SP_POP_TOTL: 'Population',
    'country.name': 'Country',
    ['__proto__']: 'A column',
    constructor: 'Another column',
  };
  const datasource: LabelDatasource = {
    chart_display_labels: { '12': labels },
  };
  const result = withChartDisplayLabels(datasource, 12);

  expect(result.verbose_map).toEqual(labels);
  expect(Object.getPrototypeOf(result.verbose_map)).toBe(Object.prototype);
  expect(
    Object.prototype.hasOwnProperty.call(result.verbose_map, '__proto__'),
  ).toBe(true);
});
