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

import { ChartProps, DatasourceType } from '@superset-ui/core';
import transformProps from './transformProps';

// Regression for https://github.com/apache/superset/issues/34748: reporters
// on 5.0.0/6.0.0 found that only a single row's GeoJSON Feature ever
// rendered on the map, no matter how many rows the query returned (setting
// the row limit to 1 made no visible difference).
test('transformProps builds a feature for every row, not just the first', () => {
  const mockChartProps: Partial<ChartProps> = {
    rawFormData: {
      geojson: 'geometry',
      viewport: {},
    },
    queriesData: [
      {
        data: [
          {
            geometry: JSON.stringify({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.92, 47.38] },
              properties: {},
            }),
          },
          {
            geometry: JSON.stringify({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.93, 47.39] },
              properties: {},
            }),
          },
          {
            geometry: JSON.stringify({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.94, 47.4] },
              properties: {},
            }),
          },
        ],
      },
    ],
    datasource: {
      type: DatasourceType.Table,
      id: 1,
      name: 'test_datasource',
      columns: [],
      metrics: [],
    },
    height: 400,
    width: 600,
    hooks: {},
    filterState: {},
    emitCrossFilters: false,
  };

  const result = transformProps(mockChartProps as ChartProps);
  const features = result.payload.data.features as Array<{
    geometry: { coordinates: number[] };
  }>;

  expect(features).toHaveLength(3);
  expect(features.map(f => f.geometry.coordinates)).toEqual([
    [2.92, 47.38],
    [2.93, 47.39],
    [2.94, 47.4],
  ]);
});
