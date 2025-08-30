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
import { colorFromBounds } from './colorUtils';

describe('colorFromBounds', () => {
  test('should return null when no bounds are provided', () => {
    expect(colorFromBounds(50)).toBeNull();
    expect(colorFromBounds(50, undefined)).toBeNull();
  });

  test('should return null when bounds is empty array', () => {
    expect(colorFromBounds(50, [])).toBeNull();
  });

  test('should handle min and max bounds with color scale', () => {
    const result = colorFromBounds(50, [0, 100]);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('should handle only min bound', () => {
    const result1 = colorFromBounds(50, [30, null]);
    const result2 = colorFromBounds(20, [30, null]);

    expect(result1).toBe('#0571b0'); // maxColor when value >= min
    expect(result2).toBe('#ca0020'); // minColor when value < min
  });

  test('should handle only max bound', () => {
    const result1 = colorFromBounds(50, [null, 70]);
    const result2 = colorFromBounds(80, [null, 70]);

    expect(result1).toBe('#0571b0'); // maxColor when value < max
    expect(result2).toBe('#ca0020'); // minColor when value >= max
  });

  test('should handle null value with min bound', () => {
    const result = colorFromBounds(null, [30, null]);
    expect(result).toBe('#ca0020'); // minColor when value is null
  });

  test('should handle null value with max bound', () => {
    const result = colorFromBounds(null, [null, 70]);
    expect(result).toBe('#ca0020'); // minColor when value is null
  });

  test('should handle custom color bounds', () => {
    const customColors = ['#ff0000', '#00ff00'];
    const result1 = colorFromBounds(50, [30, null], customColors);
    const result2 = colorFromBounds(20, [30, null], customColors);

    expect(result1).toBe('#00ff00'); // custom maxColor
    expect(result2).toBe('#ff0000'); // custom minColor
  });

  test('should handle edge case with min equals max', () => {
    const result = colorFromBounds(50, [50, 50]);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('should handle value of 0', () => {
    const result = colorFromBounds(0, [0, 100]);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('should handle negative values', () => {
    const result = colorFromBounds(-50, [-100, 0]);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
