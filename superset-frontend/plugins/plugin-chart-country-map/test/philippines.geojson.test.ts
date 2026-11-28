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

import fs from 'fs';
import path from 'path';

type Ring = number[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };
type Feature = {
  properties: { ISO: string; NAME_1: string };
  geometry: Geometry;
};

// `.geojson` imports are mocked out to an empty object by the Jest module
// mapper (see jest.config.js), so the file is read from disk directly to
// exercise the real, committed data.
function loadPhilippinesGeoJson(): { features: Feature[] } {
  const filePath = path.join(__dirname, '../src/countries/philippines.geojson');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Shoelace signed area: negative means clockwise in x/y order.
function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function polygonsOf(geometry: Geometry): Ring[][] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
}

test('philippines.geojson has 83 provinces with distinct non-empty ISO codes', () => {
  const { features } = loadPhilippinesGeoJson();

  expect(features.length).toBe(83);
  const isoCodes = features.map(feature => feature.properties.ISO);
  isoCodes.forEach(iso => expect(iso).toBeTruthy());
  expect(new Set(isoCodes).size).toBe(83);
});

test('philippines.geojson exteriors are clockwise and holes counterclockwise', () => {
  const { features } = loadPhilippinesGeoJson();

  // d3 v3 reads a counterclockwise exterior as the spherical complement, so
  // a regression here renders the whole globe minus the Philippines.
  features.forEach(feature => {
    polygonsOf(feature.geometry).forEach(([exterior, ...holes]) => {
      expect(signedArea(exterior)).toBeLessThan(0);
      holes.forEach(hole => expect(signedArea(hole)).toBeGreaterThan(0));
    });
  });
});
