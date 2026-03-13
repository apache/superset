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

import { ChartDataResponseResult } from '@superset-ui/core';
import { applyTimeGrainAllowlist } from './FilterValue';

const baseResults = [
  {
    data: [
      { duration: 'PT1H', name: 'Hour' },
      { duration: 'P1D', name: 'Day' },
      { duration: 'P1W', name: 'Week' },
      { duration: 'P1M', name: 'Month' },
    ],
  },
] as unknown as ChartDataResponseResult[];

test('applyTimeGrainAllowlist should filter to configured durations', () => {
  const filtered = applyTimeGrainAllowlist(
    'filter_timegrain',
    ['PT1H', 'P1D', 'P1W'],
    baseResults,
  );

  expect(filtered[0].data).toEqual([
    { duration: 'PT1H', name: 'Hour' },
    { duration: 'P1D', name: 'Day' },
    { duration: 'P1W', name: 'Week' },
  ]);
});

test('applyTimeGrainAllowlist should return unfiltered results for non-timegrain filters', () => {
  const filtered = applyTimeGrainAllowlist('filter_select', ['PT1H'], baseResults);
  expect(filtered).toEqual(baseResults);
});

test('applyTimeGrainAllowlist should return unfiltered results when allowlist is empty', () => {
  const filtered = applyTimeGrainAllowlist('filter_timegrain', [], baseResults);
  expect(filtered).toEqual(baseResults);
});
