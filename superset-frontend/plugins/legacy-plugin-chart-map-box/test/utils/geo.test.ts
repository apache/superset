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

import {
  kmToPixels,
  EARTH_CIRCUMFERENCE_KM,
  MILES_PER_KM,
} from '../../src/utils/geo';

test('converts kilometers to pixels at equator (0 degrees) at zoom level 0', () => {
  const result = kmToPixels(100, 0, 0);
  expect(result).toBeGreaterThan(0);
  expect(typeof result).toBe('number');
});

test('converts kilometers to pixels at equator (0 degrees) at zoom level 10', () => {
  const km = 10;
  const result = kmToPixels(km, 0, 10);
  expect(result).toBeGreaterThan(0);
  expect(typeof result).toBe('number');
});

test('higher zoom levels result in more pixels per kilometer', () => {
  const km = 10;
  const latitude = 0;
  const lowZoom = kmToPixels(km, latitude, 5);
  const highZoom = kmToPixels(km, latitude, 10);

  expect(highZoom).toBeGreaterThan(lowZoom);
});

test('same distance at higher latitude results in more pixels (Mercator distortion)', () => {
  const km = 10;
  const zoom = 10;
  const equatorPixels = kmToPixels(km, 0, zoom);
  const midLatPixels = kmToPixels(km, 45, zoom);

  expect(midLatPixels).toBeGreaterThan(equatorPixels);
});

test('handles negative latitudes correctly', () => {
  const km = 10;
  const zoom = 10;
  const northPixels = kmToPixels(km, 45, zoom);
  const southPixels = kmToPixels(km, -45, zoom);

  expect(northPixels).toBeCloseTo(southPixels, 2);
});

test('uses correct Earth circumference constant', () => {
  expect(EARTH_CIRCUMFERENCE_KM).toBe(40075.16);
});

test('uses correct miles to kilometers conversion factor', () => {
  expect(MILES_PER_KM).toBe(1.60934);
});

test('returns rounded result with 2 decimal places', () => {
  const result = kmToPixels(10, 45, 10);
  expect(Number.isFinite(result)).toBe(true);
  expect(Math.round(result * 100) / 100).toBeCloseTo(result, 10);
});

test('handles zero kilometers', () => {
  const result = kmToPixels(0, 0, 10);
  expect(result).toBe(0);
});

test('handles very small distances', () => {
  const result = kmToPixels(0.001, 0, 10);
  expect(result).toBeGreaterThanOrEqual(0);
  expect(typeof result).toBe('number');
});

test('handles large distances', () => {
  const result = kmToPixels(10000, 0, 5);
  expect(result).toBeGreaterThan(0);
  expect(typeof result).toBe('number');
});

test('handles poles (90 degrees latitude)', () => {
  const result = kmToPixels(10, 90, 10);
  expect(result).toBeGreaterThanOrEqual(0);
  expect(typeof result).toBe('number');
});

test('handles poles (-90 degrees latitude)', () => {
  const result = kmToPixels(10, -90, 10);
  expect(result).toBeGreaterThanOrEqual(0);
  expect(typeof result).toBe('number');
});

test('pixel count increases exponentially with zoom level', () => {
  const km = 10;
  const latitude = 0;
  const zoom5 = kmToPixels(km, latitude, 5);
  const zoom6 = kmToPixels(km, latitude, 6);
  const zoom7 = kmToPixels(km, latitude, 7);

  const ratio1 = zoom6 / zoom5;
  const ratio2 = zoom7 / zoom6;

  expect(ratio1).toBeCloseTo(2, 0);
  expect(ratio2).toBeCloseTo(2, 0);
});
