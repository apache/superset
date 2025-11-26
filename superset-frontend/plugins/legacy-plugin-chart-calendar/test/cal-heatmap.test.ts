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
import CalendarChartPlugin from '../src/index';
import CalHeatMap from '../src/vendor/cal-heatmap';

/**
 * The example tests in this file act as a starting point, and
 * we encourage you to build more.
 */
describe('@superset-ui/legacy-plugin-chart-calendar', () => {
  it('exists', () => {
    expect(CalendarChartPlugin).toBeDefined();
  });
});

/**
 * This test tests that a reasonble starting date is selected given range
 * and starting date. Since time offset is calculated, 2024-12-31 is also
 * acceptable.
 */
describe('getMonthDomain filter month-day', () => {
it('returns correct month domain for 2025-01-01 to 2025-02-31', () => {
  const getMonthDomain = (CalHeatMap as any).prototype.getMonthDomain;
  const d = new Date(Date.UTC(2025, 0, 1));
  const range = 2;
  const result = getMonthDomain(d, range);
  expect(result[0].toISOString()).toContain('2025-01-01' || '2024-12-31');
  });
});