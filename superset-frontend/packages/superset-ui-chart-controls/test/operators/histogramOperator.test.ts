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
import { histogramOperator } from '@superset-ui/chart-controls';
import { SqlaFormData } from '@superset-ui/core';
import { omit } from 'lodash';

const formData: SqlaFormData = {
  bins: 5,
  column: 'quantity',
  cumulative: true,
  normalize: true,
  groupby: ['country', 'region'],
  viz_type: 'histogram',
  datasource: 'foo',
};

test('matches formData', () => {
  expect(histogramOperator(formData, {})).toEqual({
    operation: 'histogram',
    options: omit(formData, ['viz_type', 'datasource']),
  });
});

test('sets default groupby', () => {
  expect(
    histogramOperator({ ...formData, groupby: undefined }, {})?.options
      ?.groupby,
  ).toEqual([]);
});

test('defaults to 5 bins', () => {
  expect(
    histogramOperator(omit(formData, ['bins']) as SqlaFormData, {}),
  ).toEqual({
    operation: 'histogram',
    options: omit(formData, ['viz_type', 'datasource']),
  });
});
