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

import { buildColorExpression, compileColorAccessor } from './styling';
import { RGBAColor } from './layerSettings';

const TEAL: RGBAColor = [0, 122, 135, 255];
const point = (properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [0, 0] },
  properties,
});

test('builds an rgba expression with alpha scaled to 0–1', () => {
  expect(buildColorExpression([0, 122, 135, 127.5])).toEqual([
    'rgba',
    0,
    122,
    135,
    0.5,
  ]);
});

test('a fixed colour expression returns the same 0–255 colour', () => {
  const getColor = compileColorAccessor(buildColorExpression(TEAL), TEAL);
  expect(getColor(point({}))).toEqual(TEAL);
});

test('features the expression cannot evaluate get the fallback colour', () => {
  const getColor = compileColorAccessor(
    ['case', ['>', ['to-number', ['get', 'v']], 5], 'red', 'blue'],
    TEAL,
  );
  expect(getColor(point({ v: 'abc' }))).toEqual(TEAL);
});

test('throws when the expression does not compile', () => {
  expect(() =>
    compileColorAccessor(['not-an-operator'] as never, TEAL),
  ).toThrow();
});
