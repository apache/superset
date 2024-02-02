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
  isSavedMetric,
  isAdhocMetricSimple,
  isAdhocMetricSQL,
  isQueryFormMetric,
} from '@superset-ui/core';

const adhocMetricSimple = {
  expressionType: 'SIMPLE',
  column: {
    id: 1,
    column_name: 'sales',
    columnName: 'sales',
    verbose_name: 'sales',
  },
  aggregate: 'SUM',
  label: 'count',
  optionName: 'count',
};

const adhocMetricSQL = {
  expressionType: 'SQL',
  label: 'count',
  optionName: 'count',
  sqlExpression: 'count(*)',
};

const savedMetric = 'count(*)';

test('isSavedMetric returns true', () => {
  expect(isSavedMetric(savedMetric)).toEqual(true);
});

test('isSavedMetric returns false', () => {
  expect(isSavedMetric(adhocMetricSQL)).toEqual(false);
  expect(isSavedMetric(null)).toEqual(false);
  expect(isSavedMetric(undefined)).toEqual(false);
});

test('isAdhocMetricSimple returns true', () => {
  expect(isAdhocMetricSimple(adhocMetricSimple)).toEqual(true);
});

test('isAdhocMetricSimple returns false', () => {
  expect(isAdhocMetricSimple('hello')).toEqual(false);
  expect(isAdhocMetricSimple({})).toEqual(false);
  expect(isAdhocMetricSimple(adhocMetricSQL)).toEqual(false);
});

test('isAdhocMetricSQL returns true', () => {
  expect(isAdhocMetricSQL(adhocMetricSQL)).toEqual(true);
});

test('isAdhocMetricSQL returns false', () => {
  expect(isAdhocMetricSQL('hello')).toEqual(false);
  expect(isAdhocMetricSQL({})).toEqual(false);
  expect(isAdhocMetricSQL(adhocMetricSimple)).toEqual(false);
});

test('isQueryFormMetric returns true', () => {
  expect(isQueryFormMetric(adhocMetricSQL)).toEqual(true);
  expect(isQueryFormMetric(adhocMetricSimple)).toEqual(true);
  expect(isQueryFormMetric(savedMetric)).toEqual(true);
});

test('isQueryFormMetric returns false', () => {
  expect(isQueryFormMetric({})).toEqual(false);
  expect(isQueryFormMetric(undefined)).toEqual(false);
  expect(isQueryFormMetric(null)).toEqual(false);
});
