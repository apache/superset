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
  getSafeCellSize,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
} from './getSafeCellSize';

describe('getSafeCellSize', () => {
  test('defaults to 200 when value is not finite', () => {
    expect(getSafeCellSize({ cellSize: 'nope' })).toBe(200);
  });

  test('clamps below minimum', () => {
    expect(getSafeCellSize({ cellSize: 1 })).toBe(MIN_CELL_SIZE);
  });

  test('clamps above maximum', () => {
    expect(getSafeCellSize({ cellSize: 999999 })).toBe(MAX_CELL_SIZE);
  });

  test('auto-scales when estimated grid is too large', () => {
    const size = getSafeCellSize({
      cellSize: 1,
      viewport: { width: 11000, height: 11000 },
    });

    expect(size).toBeGreaterThan(MIN_CELL_SIZE);
  });

  test('never exceeds MAX_CELL_SIZE', () => {
    const size = getSafeCellSize({
      cellSize: 1,
      viewport: { width: 100000, height: 100000 },
    });

    expect(size).toBeLessThanOrEqual(MAX_CELL_SIZE);
  });

  test('calls onAutoAdjust when scaling happens', () => {
    const spy = jest.fn();

    getSafeCellSize({
      cellSize: 1,
      viewport: { width: 11000, height: 11000 },
      onAutoAdjust: spy,
    });

    expect(spy).toHaveBeenCalled();
  });
});
