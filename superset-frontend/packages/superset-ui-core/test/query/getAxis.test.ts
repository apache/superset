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
import {
  isXAxisSet,
  getXAxisColumn,
  getXAxisLabel,
  DTTM_ALIAS,
  VizType,
} from '@superset-ui/core';

test('isXAxisSet', () => {
  expect(
    isXAxisSet({ datasource: '123', viz_type: VizType.Table }),
  ).not.toBeTruthy();
  expect(
    isXAxisSet({ datasource: '123', viz_type: VizType.Table, x_axis: 'axis' }),
  ).toBeTruthy();
});

test('getXAxisColumn returns undefined when neither granularity_sqla nor x_axis is set', () => {
  expect(
    getXAxisColumn({ datasource: '123', viz_type: VizType.Table }),
  ).toBeUndefined();
});

test('getXAxisColumn returns x_axis when x_axis is set', () => {
  expect(
    getXAxisColumn({
      datasource: '123',
      viz_type: VizType.Table,
      x_axis: 'my_axis',
    }),
  ).toBe('my_axis');
});

test('getXAxisColumn returns DTTM_ALIAS when only granularity_sqla is set', () => {
  expect(
    getXAxisColumn({
      datasource: '123',
      viz_type: VizType.Table,
      granularity_sqla: 'ds',
    }),
  ).toBe(DTTM_ALIAS);
});

test('getXAxisLabel returns the column label when x_axis is set', () => {
  expect(
    getXAxisLabel({
      datasource: '123',
      viz_type: VizType.Table,
      x_axis: 'my_axis',
    }),
  ).toBe('my_axis');
});

test('getXAxisLabel returns undefined when no column is set', () => {
  expect(
    getXAxisLabel({ datasource: '123', viz_type: VizType.Table }),
  ).toBeUndefined();
});
