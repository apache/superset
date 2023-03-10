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

export interface ChartListChart {
  id: number;
  slice_name: string;
  url: string;
  last_saved_at: null | string;
  last_saved_by: null | { id: number; first_name: string; last_name: string };
  owners: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  }[];
  dashboards: { id: number; dashboard_title: string }[];
}

const CHART_ID = 1;
const MOCK_CHART: ChartListChart = {
  id: CHART_ID,
  slice_name: 'Sample chart',
  url: `/explore/?slice_id=${CHART_ID}`,
  last_saved_at: null,
  dashboards: [],
  last_saved_by: null,
  owners: [],
};

/**
 * Get mock charts as would be returned by the /api/v1/chart list endpoint.
 */
export const getMockChart = (
  overrides: Partial<ChartListChart> = {},
): ChartListChart => ({
  ...MOCK_CHART,
  ...(overrides.id ? { url: `/explore/?slice_id=${overrides.id}` } : null),
  ...overrides,
});
