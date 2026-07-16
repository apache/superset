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
import { getPoints } from './H3Hexagon';

test('getPoints returns every boundary vertex of each hexagon for viewport fitting', () => {
  const points = getPoints([{ hexagon: '891f1d48177ffff' }]);
  // A single H3 cell has 6 boundary vertices; fitting to only one would clip.
  expect(points.length).toBeGreaterThan(1);
  points.forEach(([lng, lat]) => {
    expect(typeof lng).toBe('number');
    expect(typeof lat).toBe('number');
  });
});

test('getPoints accumulates vertices across multiple hexagons', () => {
  const single = getPoints([{ hexagon: '891f1d48177ffff' }]);
  const pair = getPoints([
    { hexagon: '891f1d48177ffff' },
    { hexagon: '891f1d48163ffff' },
  ]);
  expect(pair.length).toBe(single.length * 2);
});

test('getPoints skips features with an empty hexagon', () => {
  expect(getPoints([{ hexagon: '' }])).toEqual([]);
});
