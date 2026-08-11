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
import { getEchartsTheme } from '../../src/utils/echartsTheme';

const theme = {
  colorText: '#111',
  colorTextSecondary: '#666',
  colorTextDisabled: '#aaa',
  colorSplit: '#eee',
  colorBorderSecondary: '#ddd',
  colorBgContainer: '#fff',
  colorPrimary: '#20a7c9',
  fontFamily: 'Inter',
} as unknown as Parameters<typeof getEchartsTheme>[0];

test('styles an axis only when the option declares one', () => {
  // An axis section on a pie would draw a cartesian grid that is not there.
  expect(
    getEchartsTheme(theme, { series: [{ type: 'pie' }] }).xAxis,
  ).toBeUndefined();
});

test('matches the shape of an axis authored as an array', () => {
  const themed = getEchartsTheme(theme, {
    xAxis: { type: 'category' },
    yAxis: [{ type: 'value' }, { type: 'value' }],
  });

  // A single object merged over an authored array is replaced wholesale by
  // it, so a chart with two y-axes lost all of its axis styling.
  expect(Array.isArray(themed.yAxis)).toBe(true);
  expect(themed.yAxis).toHaveLength(2);
  expect(themed.yAxis[1].axisLabel.color).toBe('#666');
  expect(Array.isArray(themed.xAxis)).toBe(false);
  expect(themed.xAxis.splitLine.lineStyle.color).toBe('#eee');
});
