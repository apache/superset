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
import { applyStructuredChrome } from './echartsStructuredChrome';

test('an unset chrome (no chartChrome at all) leaves the raw option untouched', () => {
  const raw = { title: { text: 'Raw title' }, legend: { orient: 'vertical' } };
  expect(applyStructuredChrome(raw, undefined)).toBe(raw);
});

test('every field at its default leaves the raw option untouched, same reference', () => {
  const raw = { title: { text: 'Raw title' } };
  const chrome = {
    titleText: '',
    legendShow: true,
    legendPosition: null,
    tooltipTrigger: null,
    xAxisName: '',
    xAxisRotate: 0,
    xAxisFormat: '',
    yAxisName: '',
    yAxisRotate: 0,
    yAxisFormat: '',
  };
  expect(applyStructuredChrome(raw, chrome)).toBe(raw);
});

test('a structured titleText wins over the raw title, merged onto its own object', () => {
  const raw = { title: { textStyle: { fontSize: 20 } } };
  const merged = applyStructuredChrome(raw, { titleText: 'Sales' });
  expect(merged.title).toEqual({ textStyle: { fontSize: 20 }, text: 'Sales' });
});

test('legendShow: false hides the legend regardless of the raw config', () => {
  const raw = { legend: { orient: 'vertical' } };
  const merged = applyStructuredChrome(raw, { legendShow: false });
  expect(merged.legend).toEqual({ orient: 'vertical', show: false });
});

test('legendPosition maps to the top/left pair ECharts actually reads', () => {
  const merged = applyStructuredChrome({}, { legendPosition: 'right' });
  expect(merged.legend).toEqual({ top: 'middle', left: 'right' });
});

test('tooltipTrigger applies onto the raw tooltip config, unmanaged keys survive', () => {
  const raw = { tooltip: { formatter: '{b}: {c}' } };
  const merged = applyStructuredChrome(raw, { tooltipTrigger: 'axis' });
  expect(merged.tooltip).toEqual({ formatter: '{b}: {c}', trigger: 'axis' });
});

test('axis name/rotate/format merge into name + axisLabel, raw axisLabel keys survive', () => {
  const raw = { xAxis: { type: 'category', axisLabel: { color: 'red' } } };
  const merged = applyStructuredChrome(raw, {
    xAxisName: 'Product',
    xAxisRotate: 45,
    xAxisFormat: '{value} kg',
  });
  expect(merged.xAxis).toEqual({
    type: 'category',
    name: 'Product',
    axisLabel: { color: 'red', rotate: 45, formatter: '{value} kg' },
  });
});

test('xAxis and yAxis are managed independently', () => {
  const merged = applyStructuredChrome(
    { xAxis: {}, yAxis: {} },
    { xAxisName: 'X', yAxisName: 'Y' },
  );
  expect(merged.xAxis).toEqual({ name: 'X' });
  expect(merged.yAxis).toEqual({ name: 'Y' });
});

test('unmanaged raw properties outside title/legend/tooltip/xAxis/yAxis survive untouched', () => {
  const raw = {
    series: [{ type: 'bar', data: [1, 2] }],
    grid: { left: 10 },
    title: { text: 'raw' },
  };
  const merged = applyStructuredChrome(raw, { legendShow: false });
  expect(merged.series).toBe(raw.series);
  expect(merged.grid).toBe(raw.grid);
  expect(merged.title).toBe(raw.title);
});
