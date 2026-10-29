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
import { TimeGranularity } from '@superset-ui/core';
import { getSunburstTimeGrain } from '../../src/Sunburst/timeGrain';
import { EchartsSunburstFormData } from '../../src/Sunburst/types';

const formData: EchartsSunburstFormData = {
  datasource: '1__table',
  viz_type: 'sunburst_v2',
  groupby: [],
  metric: 'count',
  columns: ['d1', 'd2'],
  temporalColumnsLookup: { d1: true, d2: true },
  timeGrainSqla: TimeGranularity.MONTH,
};

test('grains every lookup-marked temporal hierarchy level', () => {
  expect(getSunburstTimeGrain(formData, 'd1')).toBe(TimeGranularity.MONTH);
  expect(getSunburstTimeGrain(formData, 'd2')).toBe(TimeGranularity.MONTH);
});

test('dashboard time column does not disable lookup-marked temporal levels', () => {
  const overridden = {
    ...formData,
    granularitySqla: 'd1',
    extraFormData: { granularity_sqla: 'd2' },
  };
  expect(getSunburstTimeGrain(overridden, 'd1')).toBe(TimeGranularity.MONTH);
  expect(getSunburstTimeGrain(overridden, 'd2')).toBe(TimeGranularity.MONTH);
});

test('ignores unselected temporal columns when identifying a semantic time axis', () => {
  expect(getSunburstTimeGrain({ ...formData, columns: ['d1'] }, 'd1')).toBe(
    TimeGranularity.MONTH,
  );
});
