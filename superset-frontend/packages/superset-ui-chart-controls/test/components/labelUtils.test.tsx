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
import React from 'react';

import {
  getColumnLabelText,
  getColumnTooltipNode,
  getMetricTooltipNode,
} from '../../src/components/labelUtils';

test("should get column name when column doesn't have verbose_name", () => {
  expect(
    getColumnLabelText({
      id: 123,
      column_name: 'column name',
      verbose_name: '',
    }),
  ).toBe('column name');
});

test('should get verbose name when column have verbose_name', () => {
  expect(
    getColumnLabelText({
      id: 123,
      column_name: 'column name',
      verbose_name: 'verbose name',
    }),
  ).toBe('verbose name');
});

test('should get null as tooltip', () => {
  const ref = { current: { scrollWidth: 100, clientWidth: 100 } };
  expect(
    getColumnTooltipNode(
      {
        id: 123,
        column_name: 'column name',
        verbose_name: '',
      },
      ref,
    ),
  ).toBe(null);
});

test('should get column name and verbose name when it has a verbose name', () => {
  const rvNode = (
    <>
      <div>column name: column name</div>
      <div>verbose name: verbose name</div>
    </>
  );

  const ref = { current: { scrollWidth: 100, clientWidth: 100 } };
  expect(
    getColumnTooltipNode(
      {
        id: 123,
        column_name: 'column name',
        verbose_name: 'verbose name',
      },
      ref,
    ),
  ).toStrictEqual(rvNode);
});

test('should get column name as tooltip if it overflowed', () => {
  const ref = { current: { scrollWidth: 200, clientWidth: 100 } };
  expect(
    getColumnTooltipNode(
      {
        id: 123,
        column_name: 'long long long long column name',
        verbose_name: '',
      },
      ref,
    ),
  ).toBe('column name: long long long long column name');
});

test('should get column name and verbose name as tooltip if it overflowed', () => {
  const rvNode = (
    <>
      <div>column name: long long long long column name</div>
      <div>verbose name: long long long long verbose name</div>
    </>
  );

  const ref = { current: { scrollWidth: 200, clientWidth: 100 } };
  expect(
    getColumnTooltipNode(
      {
        id: 123,
        column_name: 'long long long long column name',
        verbose_name: 'long long long long verbose name',
      },
      ref,
    ),
  ).toStrictEqual(rvNode);
});

test('should get null as tooltip in metric', () => {
  const ref = { current: { scrollWidth: 100, clientWidth: 100 } };
  expect(
    getMetricTooltipNode(
      {
        metric_name: 'count',
        label: '',
        verbose_name: '',
      },
      ref,
    ),
  ).toBe(null);
});

test('should get metric name and verbose name as tooltip in metric', () => {
  const rvNode = (
    <>
      <div>metric name: count</div>
      <div>verbose name: count(*)</div>
    </>
  );

  const ref = { current: { scrollWidth: 100, clientWidth: 100 } };
  expect(
    getMetricTooltipNode(
      {
        metric_name: 'count',
        label: 'count(*)',
        verbose_name: 'count(*)',
      },
      ref,
    ),
  ).toStrictEqual(rvNode);
});

test('should get metric name and verbose name in tooltip if it overflowed', () => {
  const rvNode = (
    <>
      <div>metric name: count</div>
      <div>verbose name: longlonglonglonglong verbose metric</div>
    </>
  );

  const ref = { current: { scrollWidth: 200, clientWidth: 100 } };
  expect(
    getMetricTooltipNode(
      {
        metric_name: 'count',
        label: '',
        verbose_name: 'longlonglonglonglong verbose metric',
      },
      ref,
    ),
  ).toStrictEqual(rvNode);
});

test('should get label name as tooltip in metric if it overflowed', () => {
  const ref = { current: { scrollWidth: 200, clientWidth: 100 } };
  expect(
    getMetricTooltipNode(
      {
        metric_name: 'count',
        label: 'longlonglonglonglong metric label',
        verbose_name: '',
      },
      ref,
    ),
  ).toBe('label name: longlonglonglonglong metric label');
});
