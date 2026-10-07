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
import { resolveOption } from './resolveBindings';

const ctx = {
  rows: [
    { line: 'Cars', revenue: 10 },
    { line: 'Ships', revenue: 4 },
  ],
  theme: { colorPrimary: '#20a7c9' },
};

test('fills metric, dimension, records and theme markers', () => {
  const option = resolveOption(
    {
      color: [{ $bind: { source: 'theme', token: 'colorPrimary' } }],
      xAxis: { data: { $bind: { source: 'dimension', alias: 'line' } } },
      series: [
        { data: { $bind: { source: 'metric', alias: 'revenue' } } },
        {
          data: {
            $bind: {
              source: 'records',
              fields: { name: 'line', value: 'revenue' },
            },
          },
        },
      ],
      title: {
        text: { $bind: { source: 'metric', alias: 'revenue', single: true } },
      },
    },
    ctx,
  );

  expect(option.color).toEqual(['#20a7c9']);
  expect(option.xAxis).toEqual({ data: ['Cars', 'Ships'] });
  expect(option.series).toEqual([
    { data: [10, 4] },
    {
      data: [
        { name: 'Cars', value: 10 },
        { name: 'Ships', value: 4 },
      ],
    },
  ]);
  expect(option.title).toEqual({ text: 10 });
});

test('drops URL keys and forces rich-text tooltips', () => {
  const option = resolveOption(
    {
      title: { text: 'x', link: 'https://example.com' },
      tooltip: { trigger: 'item' },
    },
    ctx,
  );

  expect(option.title).toEqual({ text: 'x' });
  expect(option.tooltip).toEqual({ trigger: 'item', renderMode: 'richText' });
});

test('rejects function-only keys and unwrapped markers', () => {
  expect(() =>
    resolveOption({ tooltip: { valueFormatter: 'x' } }, ctx),
  ).toThrow(/must be a function/);
  expect(() =>
    resolveOption({ data: { source: 'metric', alias: 'revenue' } }, ctx),
  ).toThrow(/without its "\$bind" wrapper/);
});
