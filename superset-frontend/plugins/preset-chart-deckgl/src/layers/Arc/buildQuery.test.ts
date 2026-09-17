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
import buildQuery, { DeckArcFormData } from './buildQuery';

const baseFormData: DeckArcFormData = {
  datasource: '1__table',
  viz_type: 'deck_arc',
  start_spatial: { type: 'latlong', lonCol: 'start_lon', latCol: 'start_lat' },
  end_spatial: { type: 'latlong', lonCol: 'end_lon', latCol: 'end_lat' },
};

test('Arc buildQuery is not a timeseries query by default', () => {
  expect(buildQuery(baseFormData).queries[0].is_timeseries).toBe(false);
});

test('Arc buildQuery is timeseries only when time_grain_sqla is set', () => {
  const [query] = buildQuery({
    ...baseFormData,
    time_grain_sqla: 'P1D',
  }).queries;
  expect(query.is_timeseries).toBe(true);
});
