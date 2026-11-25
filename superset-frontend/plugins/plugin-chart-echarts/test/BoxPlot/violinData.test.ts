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
import violinData from '../../src/BoxPlot/stories/violinData';

const realRows = violinData.filter(row => !row.region.endsWith('(synthetic)'));

const findRow = (region: string) => {
  const row = violinData.find(candidate => candidate.region === region);
  if (!row) {
    throw new Error(`row ${region} not found`);
  }
  return row;
};

const trapezoidArea = (curve: [number, number][]) =>
  curve
    .slice(1)
    .reduce(
      (area, [x, density], i) =>
        area + ((x - curve[i][0]) * (density + curve[i][1])) / 2,
      0,
    );

test('rows carry the box plot columns plus a single density column', () => {
  violinData.forEach(row => {
    expect(Object.keys(row).sort()).toEqual([
      'SP_POP_TOTL__count',
      'SP_POP_TOTL__density',
      'SP_POP_TOTL__max',
      'SP_POP_TOTL__mean',
      'SP_POP_TOTL__median',
      'SP_POP_TOTL__min',
      'SP_POP_TOTL__outliers',
      'SP_POP_TOTL__q1',
      'SP_POP_TOTL__q3',
      'region',
    ]);
  });
});

test('each real curve has 100 [value, density] pairs in ascending order', () => {
  expect(realRows).toHaveLength(3);
  realRows.forEach(({ SP_POP_TOTL__density: curve }) => {
    expect(curve).toHaveLength(100);
    curve.forEach(([value, density], i) => {
      expect(density).toBeGreaterThanOrEqual(0);
      if (i > 0) {
        expect(value).toBeGreaterThan(curve[i - 1][0]);
      }
    });
  });
});

test('each real curve spans the observed range, outliers included', () => {
  realRows.forEach(row => {
    const curve = row.SP_POP_TOTL__density;
    const observed = [
      row.SP_POP_TOTL__min!,
      row.SP_POP_TOTL__max!,
      ...row.SP_POP_TOTL__outliers,
    ];
    expect(curve[0][0]).toBe(Math.min(...observed));
    expect(curve[curve.length - 1][0]).toBe(Math.max(...observed));
  });
});

test('each real curve has an area of 1', () => {
  realRows.forEach(row => {
    expect(trapezoidArea(row.SP_POP_TOTL__density)).toBeCloseTo(1, 6);
  });
});

test('a constant group is a single marker at its value', () => {
  const row = findRow('Constant (synthetic)');
  expect(row.SP_POP_TOTL__density).toEqual([[row.SP_POP_TOTL__median, 1]]);
});

test('an empty group has no curve and a count of zero', () => {
  const row = findRow('Empty (synthetic)');
  expect(row.SP_POP_TOTL__count).toBe(0);
  expect(row.SP_POP_TOTL__density).toEqual([]);
});
