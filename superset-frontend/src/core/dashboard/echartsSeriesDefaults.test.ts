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
import { applySeriesDefaults } from './echartsSeriesDefaults';
import type { ChartTheme } from './chartTheme';

const theme = {
  background: 'transparent',
  text: {
    color: '#111',
    mutedColor: '#666',
    disabledColor: '#aaa',
    fontFamily: 'Inter',
    fontSize: 12,
  },
  axis: {
    lineColor: '#eee',
    labelColor: '#666',
    gridColor: '#eee',
    minorGridColor: '#ddd',
  },
  tooltip: { background: '#fff', color: '#111' },
  accent: '#20a7c9',
  categoricalColors: ['#1f77b4'],
  sequentialColors: [],
  // Stands in for the shared label→colour memory: same label, same colour,
  // whatever order a chart happens to list it in.
  getColor: (label: string) => `colour-of-${label}`,
} satisfies ChartTheme;

const seriesOf = (option: Record<string, unknown>) =>
  (option.series as Record<string, any>[])[0];

test('gives a pie an explicit label colour, which is what suppresses the halo', () => {
  const out = applySeriesDefaults(
    { series: [{ type: 'pie', data: [] }] },
    theme,
  );

  // zrender draws its own contrasting stroke only when the label has no fill
  // of its own — an explicit colour is the whole fix.
  expect(seriesOf(out).label).toEqual({ color: '#111', fontFamily: 'Inter' });
});

test('leaves an authored label colour alone', () => {
  const out = applySeriesDefaults(
    { series: [{ type: 'pie', label: { color: 'red' } }] },
    theme,
  );

  // The point of applying defaults rather than overrides: full ECharts access
  // survives intact.
  expect(seriesOf(out).label.color).toBe('red');
  // …while still filling what the author didn't mention.
  expect(seriesOf(out).label.fontFamily).toBe('Inter');
});

test('preserves an authored value even when it is falsy or null', () => {
  const out = applySeriesDefaults(
    { series: [{ type: 'pie', labelLine: { lineStyle: { color: null } } }] },
    theme,
  );

  // `null` is how ECharts is told to drop something; treating it as "absent"
  // would silently re-enable what the author switched off.
  expect(seriesOf(out).labelLine.lineStyle.color).toBeNull();
});

test('themes pie leader lines and slice borders', () => {
  const out = applySeriesDefaults({ series: [{ type: 'pie' }] }, theme);

  expect(seriesOf(out).labelLine.lineStyle.color).toBe('#eee');
  expect(seriesOf(out).itemStyle.borderColor).toBe('#fff');
});

test('applies per-type defaults independently across a mixed option', () => {
  const out = applySeriesDefaults(
    { series: [{ type: 'bar' }, { type: 'pie' }, { type: 'gauge' }] },
    theme,
  );
  const series = out.series as Record<string, any>[];

  expect(series[0].labelLine).toBeUndefined(); // bar has no leader lines
  expect(series[1].labelLine.lineStyle.color).toBe('#eee');
  expect(series[2].detail.color).toBe('#111');
  series.forEach(s => expect(s.label.color).toBe('#111'));
});

test('accepts a single series object as well as an array', () => {
  const out = applySeriesDefaults({ series: { type: 'pie' } }, theme);

  expect((out.series as Record<string, any>).label.color).toBe('#111');
});

test('leaves an option with no series untouched', () => {
  const option = { xAxis: { type: 'category' } };

  expect(applySeriesDefaults(option, theme)).toBe(option);
});

test('does not mutate the option it is given', () => {
  const option = { series: [{ type: 'pie' as const }] };
  const before = JSON.stringify(option);

  applySeriesDefaults(option, theme);

  expect(JSON.stringify(option)).toBe(before);
});

test('colours a series by its name rather than by its position', () => {
  const out = applySeriesDefaults(
    {
      series: [
        { type: 'bar', name: 'EMEA' },
        { type: 'bar', name: 'APAC' },
      ],
    },
    theme,
  );

  // What makes two widgets on one dashboard agree: neither is coloured by where
  // its series happens to sit.
  const series = out.series as Record<string, any>[];
  expect(series[0].itemStyle.color).toBe('colour-of-EMEA');
  expect(series[1].itemStyle.color).toBe('colour-of-APAC');
});

test('colours a pie by slice, since a pie is one series of many categories', () => {
  const out = applySeriesDefaults(
    {
      series: [
        {
          type: 'pie',
          data: [
            { name: 'EMEA', value: 3 },
            { name: 'APAC', value: 1 },
          ],
        },
      ],
    },
    theme,
  );

  const data = seriesOf(out).data as Record<string, any>[];
  expect(data[0].itemStyle.color).toBe('colour-of-EMEA');
  expect(data[1].itemStyle.color).toBe('colour-of-APAC');
});

test('leaves a colour the author chose alone', () => {
  const out = applySeriesDefaults(
    { series: [{ type: 'bar', name: 'EMEA', itemStyle: { color: '#f00' } }] },
    theme,
  );

  expect(seriesOf(out).itemStyle.color).toBe('#f00');
});

test('leaves an unnamed series to the palette', () => {
  const out = applySeriesDefaults({ series: [{ type: 'bar' }] }, theme);

  // Nothing to ask the scale for, so the option says nothing and ECharts takes
  // the next colour off `color` as it always did.
  expect(seriesOf(out).itemStyle?.color).toBeUndefined();
});
