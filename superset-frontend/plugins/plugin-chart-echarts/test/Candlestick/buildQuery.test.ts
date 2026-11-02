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
import { QueryFormData, VizType } from '@superset-ui/core';
import buildQuery from '../../src/Candlestick/buildQuery';

const formData = {
  datasource: '5__table',
  viz_type: VizType.Candlestick,
  x_axis: 'date',
  open: 'open',
  close: 'close',
  high: 'high',
  low: 'low',
} as QueryFormData;

test('builds query fields from OHLC metrics and x-axis', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.metrics).toEqual(['open', 'close', 'high', 'low']);
  expect(query.columns?.[0]).toEqual(
    expect.objectContaining({ sqlExpression: 'date' }),
  );
  expect(query.orderby).toEqual([['date', true]]);
});

test('includes an optional series dimension', () => {
  const [query] = buildQuery({
    ...formData,
    series: 'symbol',
  }).queries;
  expect(query.columns?.[1]).toEqual('symbol');
  expect(query.series_columns).toEqual(['symbol']);
});

test('issues no metrics when none are selected', () => {
  const [query] = buildQuery({
    datasource: '5__table',
    viz_type: VizType.Candlestick,
    x_axis: 'date',
  } as QueryFormData).queries;
  expect(query.metrics).toEqual([]);
});
