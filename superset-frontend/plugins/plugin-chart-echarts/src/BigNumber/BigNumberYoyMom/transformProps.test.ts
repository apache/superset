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
import { BigNumberYoyMomChartProps } from './types';
import transformProps from './transformProps';

jest.mock('@apache-superset/core/translation', () => ({
  t: (text: string) => text,
}));

jest.mock('@superset-ui/core', () => ({
  getMetricLabel: jest.fn(metric => metric),
  getNumberFormatter: jest.fn(format => (value: number) => {
    if (format === ',.2%') return `${(value * 100).toFixed(2)}%`;
    return String(value);
  }),
  getValueFormatter: jest.fn(
    () => (value: number) => `$${value.toLocaleString('en-US')}`,
  ),
  NumberFormats: { PERCENT_2_POINT: ',.2%' },
}));

describe('BigNumberYoyMom transformProps', () => {
  const baseFormData = {
    metric: 'SUM(sales)',
    headerText: '本月销售额',
    yAxisFormat: 'SMART_NUMBER',
    currencyFormat: undefined,
  };

  const baseDatasource = {
    currencyFormats: {},
    columnFormats: {},
    metrics: [{ metric_name: 'SUM(sales)', d3format: '.2f' }],
  };

  const buildChartProps = (
    data: Record<string, number | string | null>[],
    formData: Record<string, unknown> = {},
    seriesData?: Record<string, number | string | null>[],
  ) =>
    ({
      width: 400,
      height: 300,
      queriesData: [
        { data, detected_currency: null },
        ...(seriesData
          ? [
              {
                data: seriesData,
                colnames: ['报表时间', 'SUM(sales)'],
                detected_currency: null,
              },
            ]
          : []),
      ],
      formData: { ...baseFormData, ...formData },
      datasource: baseDatasource,
    }) as unknown as BigNumberYoyMomChartProps;

  test('renders title, big number and both comparisons from data', () => {
    const result = transformProps(
      buildChartProps([
        {
          'SUM(sales)': 1234567,
          'SUM(sales)__1 month ago': 1000000,
          'SUM(sales)__1 year ago': 1500000,
        },
      ]),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];

    expect(graphic[0].style.text).toBe('本月销售额');
    expect(graphic[0].style.fontSize).toBe(45);
    expect(graphic[0].style.fill).toBe('rgb(102, 102, 102)');
    expect(graphic[0].left).toBe(20);
    expect(graphic[0].top).toBe(20);

    expect(graphic[1].style.text).toBe('$1,234,567');
    expect(graphic[1].style.fontSize).toBe(120);
    expect(graphic[1].style.fontWeight).toBe('bold');
    expect(graphic[1].style.fill).toBe('rgb(51, 51, 51)');

    expect(graphic[2].style.text).toBe('MoM ↑23.46%');
    expect(graphic[2].style.fill).toBe('rgb(0, 180, 42)');
    expect(graphic[2].left).toBe(20);
    // title 0.15*300=45px -> number hugs bottom: 20+54+6=80 ->
    // comparison 80 + 120*1.2 + 5 = 229 (big number default 0.4*300=120px)
    expect(graphic[2].top).toBe(229);

    expect(graphic[3].style.text).toBe('YoY ↓17.70%');
    expect(graphic[3].style.fill).toBe('rgb(245, 63, 63)');
    expect(graphic[3].left).toBe(120);
  });

  test('reads comparison values from configured result columns', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            prev_month_sales: 80,
            prev_year_sales: 120,
          },
        ],
        {
          comparison1Column: 'prev_month_sales',
          comparison2Column: 'prev_year_sales',
        },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];

    expect(graphic[2].style.text).toBe('MoM ↑25.00%');
    expect(graphic[2].style.fill).toBe('rgb(0, 180, 42)');
    expect(graphic[3].style.text).toBe('YoY ↓16.67%');
    expect(graphic[3].style.fill).toBe('rgb(245, 63, 63)');
  });

  test('time_shift mode wins over a leftover comparison column', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 90,
            prev_month_sales: 80,
          },
        ],
        {
          comparison1Mode: 'time_shift',
          comparison1Column: 'prev_month_sales',
          comparison1Offset: '1 month ago',
        },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM ↑11.11%');
  });

  test('metric mode reads the comparison metric explicitly', () => {
    const result = transformProps(
      buildChartProps(
        [{ 'SUM(sales)': 100, prev_month_sales: 80 }],
        {
          comparison1Mode: 'metric',
          comparison1Column: 'prev_month_sales',
        },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM ↑25.00%');
  });

  test('shows "—" when the configured comparison column is missing', () => {
    const result = transformProps(
      buildChartProps([{ 'SUM(sales)': 100 }], {
        comparison1Column: 'prev_month_sales',
      }),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM —');
    expect(graphic[2].style.fill).toBe('rgb(102, 102, 102)');
  });

  test('applies configurable positions, font sizes and colors', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 100,
          },
        ],
        {
          headerText: 'Revenue',
          titleFontSize: 18,
          titleColor: { r: 1, g: 2, b: 3 },
          titleLeft: 30,
          titleTop: 40,
          bigNumberFontSize: 44,
          bigNumberColor: { r: 10, g: 20, b: 30 },
          bigNumberLeft: 50,
          bigNumberTop: 80,
          comparisonFontSize: 16,
          comparisonTop: 120,
          comparison1Left: 60,
          comparison2Left: 200,
          comparisonPositiveColor: { r: 0, g: 128, b: 0 },
          comparisonNegativeColor: { r: 128, g: 0, b: 0 },
          comparisonZeroColor: { r: 200, g: 200, b: 200 },
          backgroundColor: { r: 240, g: 240, b: 240 },
        },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    const title = graphic[0];
    const bigNumber = graphic[1];
    const mom = graphic[2];

    expect(result.echartOptions.backgroundColor).toBe('rgb(240, 240, 240)');
    expect(title.style.text).toBe('Revenue');
    expect(title.style.fontSize).toBe(18);
    expect(title.style.fill).toBe('rgb(1, 2, 3)');
    expect(title.left).toBe(30);
    expect(title.top).toBe(40);

    expect(bigNumber.style.fontSize).toBe(44);
    expect(bigNumber.style.fill).toBe('rgb(10, 20, 30)');
    expect(bigNumber.left).toBe(50);
    // bigNumberTop is the gap below the title: 40 + 18*1.2 + 80 = 141.6
    expect(bigNumber.top).toBe(141.6);

    // zero percent change renders without an arrow, in the zero color
    expect(mom.style.text).toBe('MoM 0.00%');
    expect(mom.style.fill).toBe('rgb(200, 200, 200)');
    expect(mom.style.fontSize).toBe(16);
    expect(mom.left).toBe(60);
    // comparisonTop is the gap below the big number: 141.6 + 44*1.2 + 120 = 314.4
    expect(mom.top).toBe(314.4);
  });

  test('hides title when header text is empty', () => {
    const result = transformProps(
      buildChartProps([], {
        headerText: '',
        showComparison1: false,
        showComparison2: false,
      }),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    // only the big number placeholder remains
    expect(graphic).toHaveLength(1);
    expect(graphic[0].style.text).toBe('No data');
  });

  test('moves the big number and comparisons up when the title is hidden', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 90,
            'SUM(sales)__1 year ago': 80,
          },
        ],
        { headerText: '' },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    // no title element: big number takes the title spot, comparisons follow
    // its bottom edge (20 + 120 * 1.2 + 5 = 169).
    expect(graphic).toHaveLength(3);
    expect(graphic[0].style.text).toBe('$100');
    expect(graphic[0].top).toBe(20);
    expect(graphic[1].top).toBe(169);
    expect(graphic[2].top).toBe(169);
  });

  test('pushes comparisons below a large big number without overlapping', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 90,
          },
        ],
        { headerText: '', bigNumberFontSize: 60 },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    // 20 + 60 * 1.2 + 5 = 97
    expect(graphic[0].top).toBe(20);
    expect(graphic[1].top).toBe(97);
  });

  test('maps title font size ratios to pixels', () => {
    const tiny = transformProps(
      buildChartProps([{ 'SUM(sales)': 100 }], { titleFontSize: 0.125 }),
    );
    const huge = transformProps(
      buildChartProps([{ 'SUM(sales)': 100 }], { titleFontSize: 0.4 }),
    );
    const graphicTiny = tiny.echartOptions.graphic as Record<string, any>[];
    const graphicHuge = huge.echartOptions.graphic as Record<string, any>[];
    // Tiny: ceil(0.125*300)=38 -> title bottom 20+45.6=65.6 -> number 71.6
    // Huge: ceil(0.4*300)=120 -> title bottom 20+144=164 -> number 170
    expect(graphicTiny[0].style.fontSize).toBe(38);
    expect(graphicTiny[1].top).toBe(71.6);
    expect(graphicHuge[0].style.fontSize).toBe(120);
    expect(graphicHuge[1].top).toBe(170);
  });

  test('pushes the big number below a large title', () => {
    const result = transformProps(
      buildChartProps([{ 'SUM(sales)': 100 }], { titleFontSize: 40 }),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    // graphic[0]=title, graphic[1]=big number.
    // title bottom = 20 + 40 * 1.2 = 68 → big number moves to 74
    expect(graphic[0].top).toBe(20);
    expect(graphic[1].top).toBe(74);
  });

  test('uses the configured comparison gap below the big number', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 90,
          },
        ],
        { bigNumberFontSize: 80, comparisonTop: 120 },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    // graphic[0]=title, graphic[1]=big number (20+54+6=80), graphic[2]=MoM line.
    // comparison sits exactly 120px below the number: 80 + 80*1.2 + 120 = 296
    expect(graphic[1].top).toBe(80);
    expect(graphic[2].top).toBe(296);
  });

  test('shows placeholders when there is no data', () => {
    const result = transformProps(buildChartProps([]));
    const graphic = result.echartOptions.graphic as Record<string, any>[];

    // title element comes first, then the big number placeholder
    expect(graphic[0].style.text).toBe('本月销售额');
    expect(graphic[1].style.text).toBe('No data');
    expect(graphic[2].style.text).toBe('MoM —');
    expect(graphic[3].style.text).toBe('YoY —');
  });

  test('hides comparisons when disabled', () => {
    const result = transformProps(
      buildChartProps(
        [
          {
            'SUM(sales)': 100,
            'SUM(sales)__1 month ago': 90,
          },
        ],
        { showComparison1: false, showComparison2: false },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic).toHaveLength(2); // title + big number
  });

  test('shows "—" when comparison offset is missing from the data', () => {
    const result = transformProps(
      buildChartProps([{ 'SUM(sales)': 100 }]),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM —');
    expect(graphic[2].style.fill).toBe('rgb(102, 102, 102)');
  });

  test('matches point series for "No filter" time shifts', () => {
    const result = transformProps(
      buildChartProps(
        [{ 'SUM(sales)': 27656 }],
        {
          comparison1Offset: '1 month ago',
          comparison2Offset: '1 year ago',
          timeGrainSqla: 'month',
        },
        [
          { '报表时间': '2026-09-01', 'SUM(sales)': 3260 },
          { '报表时间': '2026-08-01', 'SUM(sales)': 3243 },
          { '报表时间': '2026-07-01', 'SUM(sales)': 3068 },
          { '报表时间': '2026-01-01', 'SUM(sales)': 3169 },
        ],
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];

    // (3260 - 3243) / 3243 ≈ 0.52%
    expect(graphic[2].style.text).toBe('MoM ↑0.52%');
    expect(graphic[2].style.fill).toBe('rgb(0, 180, 42)');
    // 2025-09 is not in the series → "—"
    expect(graphic[3].style.text).toBe('YoY —');
  });

  test('matches epoch-millisecond time points from expression columns', () => {
    const result = transformProps(
      buildChartProps(
        [{ 'SUM(sales)': 100 }],
        { comparison1Offset: '1 month ago', timeGrainSqla: 'month' },
        [
          { '报表时间': 1788220800000, 'SUM(sales)': 60 }, // 2026-09-01
          { '报表时间': 1785542400000, 'SUM(sales)': 50 }, // 2026-08-01
        ],
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM ↑20.00%');
  });

  test('falls back to the offset column when no point series is present', () => {
    const result = transformProps(
      buildChartProps(
        [{ 'SUM(sales)': 100, 'SUM(sales)__1 month ago': 90 }],
        { comparison1Offset: '1 month ago' },
      ),
    );
    const graphic = result.echartOptions.graphic as Record<string, any>[];
    expect(graphic[2].style.text).toBe('MoM ↑11.11%');
  });
});
