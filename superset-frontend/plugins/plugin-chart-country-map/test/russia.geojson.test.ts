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

type Position = [number, number];
type Coordinates = number | Coordinates[];
type Feature = {
  properties: { ISO: string; NAME_1: string };
  geometry: { coordinates: Coordinates };
};

function positions(coordinates: Coordinates): Position[] {
  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    return [coordinates as Position];
  }
  return (coordinates as Coordinates[]).flatMap(positions);
}

function bounds(feature: Feature) {
  const points = positions(feature.geometry.coordinates);
  return points.reduce(
    ([minX, minY, maxX, maxY], [x, y]) => [
      Math.min(minX, x),
      Math.min(minY, y),
      Math.max(maxX, x),
      Math.max(maxY, y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

test('Karelia and Murmansk have distinct full-size boundaries', () => {
  const filePath = path.join(__dirname, '../src/countries/russia.geojson');
  // The 1:50m map is about 747 kB. Replacing only the two incorrect regions
  // keeps the payload close to that baseline instead of shipping all 1:10m data.
  expect(fs.statSync(filePath).size).toBeLessThan(760_000);
  const { features }: { features: Feature[] } = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );
  const byIso = new Map(
    features.map(feature => [feature.properties.ISO, feature]),
  );

  expect(features).toHaveLength(85);
  expect(byIso.size).toBe(85);

  const karelia = byIso.get('RU-KR');
  const murmansk = byIso.get('RU-MUR');
  expect(karelia?.properties.NAME_1).toBe('Karelia');
  expect(murmansk?.properties.NAME_1).toBe('Murmansk');

  const [kareliaMinX, kareliaMinY, kareliaMaxX, kareliaMaxY] = bounds(karelia!);
  expect(kareliaMinX).toBeLessThan(30);
  expect(kareliaMinY).toBeLessThan(61);
  expect(kareliaMaxX).toBeGreaterThan(37);
  expect(kareliaMaxY).toBeGreaterThan(66);

  const [murmanskMinX, murmanskMinY, murmanskMaxX, murmanskMaxY] = bounds(
    murmansk!,
  );
  expect(murmanskMinX).toBeLessThan(30);
  expect(murmanskMinY).toBeGreaterThan(65);
  expect(murmanskMaxX).toBeGreaterThan(40);
  expect(murmanskMaxY).toBeGreaterThan(69);
});
