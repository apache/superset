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
import { EchartsSunburstFormData } from '../../src/Sunburst/types';
import { getSunburstTimeGrain } from '../../src/Sunburst/timeGrain';

const formData: EchartsSunburstFormData = {
  datasource: '1__table',
  viz_type: 'sunburst_v2',
  groupby: [],
  metric: 'count',
  temporalColumnsLookup: { ts: true, ship_date: true },
  granularitySqla: 'ts',
  timeGrainSqla: TimeGranularity.MONTH,
};

test('typed temporal fields select the same grain for rendering and querying', () => {
  expect(getSunburstTimeGrain(formData, 'ts')).toBe(TimeGranularity.MONTH);
  expect(getSunburstTimeGrain(formData, 'ship_date')).toBe(
    TimeGranularity.MONTH,
  );
  expect(
    getSunburstTimeGrain(
      {
        ...formData,
        extraFormData: {
          granularity_sqla: 'ship_date',
          time_grain_sqla: TimeGranularity.YEAR,
        },
      },
      'ship_date',
    ),
  ).toBe(TimeGranularity.YEAR);
});

test('Sunburst temporal field types reject malformed saved metadata', () => {
  // These compile-time guards fail with unused directives if the fields regress
  // to QueryFormData's untyped index signature.
  // @ts-expect-error temporal lookup must be a column-to-boolean mapping.
  const lookup: EchartsSunburstFormData['temporalColumnsLookup'] = 42;
  // @ts-expect-error Time Column must be a string.
  const subject: EchartsSunburstFormData['granularitySqla'] = 42;
  // @ts-expect-error Time grain must follow the duration contract.
  const grain: EchartsSunburstFormData['timeGrainSqla'] = 42;
  expect([lookup, subject, grain]).toHaveLength(3);
});

test('a dashboard Time Column outside the hierarchy does not disable drill grains', () => {
  const overridden = {
    ...formData,
    extraFormData: { granularity_sqla: 'created_at' },
  };
  expect(getSunburstTimeGrain(overridden, 'ts')).toBe(TimeGranularity.MONTH);
  expect(getSunburstTimeGrain(overridden, 'ship_date')).toBe(
    TimeGranularity.MONTH,
  );
});
