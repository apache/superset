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

type Point = [number, number];

// `.geojson` imports are mocked out by Jest, so read the committed file.
const { features } = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../src/countries/south_africa.geojson'),
    'utf-8',
  ),
);

function expectWithin(points: Point[], [minX, minY, maxX, maxY]: number[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  expect(Math.min(...xs)).toBeGreaterThan(minX);
  expect(Math.min(...ys)).toBeGreaterThan(minY);
  expect(Math.max(...xs)).toBeLessThan(maxX);
  expect(Math.max(...ys)).toBeLessThan(maxY);
}

test('Prince Edward Islands sit off the coast, not far south of it', () => {
  type Geometry = { type: string; coordinates: Point[][] | Point[][][] };
  const points: Point[] = features.flatMap(
    ({ geometry: g }: { geometry: Geometry }) =>
      g.coordinates.flat(g.type === 'MultiPolygon' ? 2 : 1),
  );
  // The whole map spans only the mainland...
  expectWithin(points, [16, -35, 33, -22]);

  // ...because the islands (Western Cape's 2nd polygon) sit off its coast.
  const westernCape = features.find(
    (f: { properties: { ISO: string } }) => f.properties.ISO === 'ZA-WC',
  );
  const [, [islands]] = westernCape.geometry.coordinates;
  expectWithin(islands, [28, -35, 29.5, -34]);
});
