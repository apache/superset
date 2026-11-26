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
import type { SupersetTheme } from '@apache-superset/core/theme';
import { themedOption } from './themedOption';

const theme = {
  colorText: '#eee',
  colorTextSecondary: '#aaa',
  colorTextDisabled: '#666',
  colorTextHeading: '#fff',
  colorBgContainer: '#141414',
  colorBgElevated: '#1f1f1f',
  colorBorder: '#444',
  colorBorderSecondary: '#333',
  colorSplit: '#333',
  colorPrimary: '#20a7c9',
  fontFamily: 'Inter',
  sizeUnit: 4,
} as unknown as SupersetTheme;

test('styles text and only the components the option uses', () => {
  const option = themedOption(
    {
      title: { text: 'T' },
      xAxis: { type: 'category' },
      series: [{ type: 'bar' }],
    },
    theme,
    ['#111', '#222'],
  );

  expect(option.color).toEqual(['#111', '#222']);
  expect(option.textStyle).toEqual({ color: '#eee', fontFamily: 'Inter' });
  expect(option.title).toMatchObject({
    text: 'T',
    textStyle: { color: '#eee' },
  });
  expect(option.xAxis).toMatchObject({
    type: 'category',
    axisLabel: { color: '#aaa' },
  });
  expect(option).not.toHaveProperty('yAxis');
  expect(option).not.toHaveProperty('calendar');
});

test('outlines series labels in the background color unless set', () => {
  const option = themedOption(
    {
      series: [
        { type: 'bar', label: { show: true } },
        { type: 'bar', label: { textBorderColor: 'red' } },
      ],
    },
    theme,
    [],
  );

  expect(option.series).toEqual([
    { type: 'bar', label: { show: true, textBorderColor: '#141414' } },
    { type: 'bar', label: { textBorderColor: 'red' } },
  ]);
});

test('colors labels outside shapes with the theme text color', () => {
  const option = themedOption(
    {
      series: [
        { type: 'bar', label: { show: true, position: 'top' } },
        { type: 'bar', label: { show: true, position: 'inside' } },
        { type: 'pie', label: { show: true } },
      ],
    },
    theme,
    [],
  );

  expect(option.series).toEqual([
    {
      type: 'bar',
      label: {
        show: true,
        position: 'top',
        color: '#eee',
        textBorderColor: '#141414',
      },
    },
    {
      type: 'bar',
      label: { show: true, position: 'inside', textBorderColor: '#141414' },
    },
    {
      type: 'pie',
      label: { show: true, color: '#eee', textBorderColor: '#141414' },
    },
  ]);
});

test('the option wins over theme defaults, and theme overrides win last', () => {
  const option = themedOption(
    { color: ['#abc'], textStyle: { color: 'pink' } },
    {
      ...theme,
      echartsOptionsOverrides: { textStyle: { fontSize: 14 } },
    } as SupersetTheme,
    ['#111'],
  );

  expect(option.color).toEqual(['#abc']);
  expect(option.textStyle).toEqual({
    color: 'pink',
    fontFamily: 'Inter',
    fontSize: 14,
  });
});

test('a cartesian chart gets a tight grid that keeps its axis labels in', () => {
  const { grid } = themedOption(
    { xAxis: { type: 'category' }, yAxis: {} },
    theme,
    [],
  );

  expect(grid).toEqual({
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
    outerBoundsMode: 'same',
    outerBoundsContain: 'axisLabel',
  });
});

test('the grid leaves room for a legend and a slider zoom', () => {
  const { grid } = themedOption(
    { xAxis: {}, yAxis: {}, legend: {}, dataZoom: [{ type: 'slider' }] },
    theme,
    [],
  );

  expect(grid).toMatchObject({ top: 40, bottom: 60 });
});

test("the option's own grid wins over the default", () => {
  const { grid } = themedOption(
    { xAxis: {}, yAxis: {}, grid: { left: 80 } },
    theme,
    [],
  );

  expect(grid).toMatchObject({ left: 80, right: 20 });
});

test('a chart without axes gets no grid', () => {
  expect(
    themedOption({ series: [{ type: 'pie' }] }, theme, []),
  ).not.toHaveProperty('grid');
});
