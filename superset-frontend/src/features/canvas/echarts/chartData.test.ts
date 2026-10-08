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
import { withFilters } from './chartData';

const binding = { datasetId: 13, metrics: ['count'] };

test('adds an IN clause per select filter on the same dataset', () => {
  expect(
    withFilters(binding, [
      {
        value: { datasetId: 13, column: 'country', values: ['USA', 'France'] },
      },
      { value: { datasetId: 7, column: 'country', values: ['USA'] } },
      { value: null },
    ]).filters,
  ).toEqual([
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'country',
      operator: 'IN',
      comparator: ['USA', 'France'],
    },
  ]);
});

test('leaves a binding without matching filters unchanged', () => {
  expect(withFilters(binding, [])).toBe(binding);
});
