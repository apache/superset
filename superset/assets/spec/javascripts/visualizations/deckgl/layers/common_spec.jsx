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
import { max } from 'd3-array';
import { getAggFunc, getBounds } from '../../../../../src/visualizations/deckgl/layers/common';

describe('deckgl layers common', () => {
  it('getAggFunc', () => {
    const arr = [10, 0.5, 55, 128, -10];
    expect(getAggFunc('max')(arr)).toEqual(128);
    expect(getAggFunc('min')(arr)).toEqual(-10);
    expect(getAggFunc('count')(arr)).toEqual(5);
    expect(getAggFunc('median')(arr)).toEqual(10);
    expect(getAggFunc('mean')(arr)).toEqual(36.7);
    expect(getAggFunc('p1')(arr)).toEqual(-9.58);
    expect(getAggFunc('p5')(arr)).toEqual(-7.9);
    expect(getAggFunc('p95')(arr)).toEqual(113.39999999999998);
    expect(getAggFunc('p99')(arr)).toEqual(125.08);
  });
  it('getAggFunc with accessor', () => {
    const arr = [{ foo: 1 }, { foo: 2 }, { foo: 3 }];
    const accessor = o => o.foo;
    expect(getAggFunc('count')(arr, accessor)).toEqual(3);
    expect(max(arr, accessor)).toEqual(3);
    expect(getAggFunc('max', accessor)(arr)).toEqual(3);
    expect(getAggFunc('min', accessor)(arr)).toEqual(1);
    expect(getAggFunc('median', accessor)(arr)).toEqual(2);
    expect(getAggFunc('mean', accessor)(arr)).toEqual(2);
    expect(getAggFunc('p1', accessor)(arr)).toEqual(1.02);
    expect(getAggFunc('p5', accessor)(arr)).toEqual(1.1);
    expect(getAggFunc('p95', accessor)(arr)).toEqual(2.9);
    expect(getAggFunc('p99', accessor)(arr)).toEqual(2.98);
  });

  describe('getBounds', () => {
    it('should return valid bounds for multiple points', () => {
      const points = [
        [0, 20],
        [5, 25],
        [10, 15],
      ];
      expect(getBounds(points)).toEqual([
        [0, 15],
        [10, 25],
      ]);
    });
    it('should return valid bounds for single latitude point', () => {
      const points = [
        [0, 0],
        [5, 0],
      ];
      expect(getBounds(points)).toEqual([
        [0, -0.25],
        [5, 0.25],
      ]);
    });
    it('should return valid bounds for single longitude point', () => {
      const points = [
        [0, 0],
        [0, 5],
      ];
      expect(getBounds(points)).toEqual([
        [-0.25, 0],
        [0.25, 5],
      ]);
    });
    it('should return valid bounds for single point', () => {
      const points = [
        [0, 0],
      ];
      expect(getBounds(points)).toEqual([
        [-0.25, -0.25],
        [0.25, 0.25],
      ]);
    });
    it('should return valid bounds for point 90, 180', () => {
      const points = [
        [180, 90],
      ];
      expect(getBounds(points)).toEqual([
        [179.75, 89.75],
        [180, 90],
      ]);
    });
    it('should return valid bounds for point -90, -180', () => {
      const points = [
        [-180, -90],
      ];
      expect(getBounds(points)).toEqual([
        [-180, -90],
        [-179.75, -89.75],
      ]);
    });
  });
});
