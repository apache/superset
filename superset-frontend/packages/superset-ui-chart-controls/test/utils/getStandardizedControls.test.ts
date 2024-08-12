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
import { QueryFormData } from '@superset-ui/core';
import { getStandardizedControls } from '../../src';

const formData: QueryFormData = {
  datasource: '30__table',
  viz_type: 'table',
  standardizedFormData: {
    controls: {
      metrics: ['count(*)', 'sum(sales)'],
      columns: ['gender', 'gender'],
    },
    memorizedFormData: [],
  },
};

test('without standardizedFormData', () => {
  getStandardizedControls().setStandardizedControls({
    datasource: '30__table',
    viz_type: 'table',
  });
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: [],
  });
});

test('getStandardizedControls', () => {
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: [],
  });
  getStandardizedControls().setStandardizedControls(formData);
  expect(getStandardizedControls().controls).toEqual({
    metrics: ['count(*)', 'sum(sales)'],
    columns: ['gender', 'gender'],
  });
  expect(getStandardizedControls().shiftMetric()).toEqual('count(*)');
  expect(getStandardizedControls().controls).toEqual({
    metrics: ['sum(sales)'],
    columns: ['gender', 'gender'],
  });
  expect(getStandardizedControls().popAllMetrics()).toEqual(['sum(sales)']);
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: ['gender', 'gender'],
  });
  expect(getStandardizedControls().shiftColumn()).toEqual('gender');
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: ['gender'],
  });
  expect(getStandardizedControls().popAllColumns()).toEqual(['gender']);
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: [],
  });

  getStandardizedControls().setStandardizedControls(formData);
  getStandardizedControls().clear();
  expect(getStandardizedControls().controls).toEqual({
    metrics: [],
    columns: [],
  });
});
