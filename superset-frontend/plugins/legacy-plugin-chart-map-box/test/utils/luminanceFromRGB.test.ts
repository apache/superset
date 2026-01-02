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

import luminanceFromRGB, {
  LUMINANCE_RED_WEIGHT,
  LUMINANCE_GREEN_WEIGHT,
  LUMINANCE_BLUE_WEIGHT,
} from '../../src/utils/luminanceFromRGB';

test('returns 0 for black (0, 0, 0)', () => {
  expect(luminanceFromRGB(0, 0, 0)).toBe(0);
});

test('returns maximum luminance for white (255, 255, 255)', () => {
  const expected =
    LUMINANCE_RED_WEIGHT * 255 +
    LUMINANCE_GREEN_WEIGHT * 255 +
    LUMINANCE_BLUE_WEIGHT * 255;
  expect(luminanceFromRGB(255, 255, 255)).toBe(expected);
});

test('green contributes most to perceived brightness', () => {
  const redLuminance = luminanceFromRGB(255, 0, 0);
  const greenLuminance = luminanceFromRGB(0, 255, 0);
  const blueLuminance = luminanceFromRGB(0, 0, 255);

  expect(greenLuminance).toBeGreaterThan(redLuminance);
  expect(greenLuminance).toBeGreaterThan(blueLuminance);
});

test('red contributes more than blue', () => {
  const redLuminance = luminanceFromRGB(255, 0, 0);
  const blueLuminance = luminanceFromRGB(0, 0, 255);

  expect(redLuminance).toBeGreaterThan(blueLuminance);
});

test('uses correct weight coefficients', () => {
  expect(LUMINANCE_RED_WEIGHT).toBe(0.2126);
  expect(LUMINANCE_GREEN_WEIGHT).toBe(0.7152);
  expect(LUMINANCE_BLUE_WEIGHT).toBe(0.0722);
});

test('calculates luminance for mid-range color (128, 128, 128)', () => {
  const expected =
    LUMINANCE_RED_WEIGHT * 128 +
    LUMINANCE_GREEN_WEIGHT * 128 +
    LUMINANCE_BLUE_WEIGHT * 128;
  expect(luminanceFromRGB(128, 128, 128)).toBe(expected);
});

test('calculates luminance for primary red', () => {
  const expected = LUMINANCE_RED_WEIGHT * 255;
  expect(luminanceFromRGB(255, 0, 0)).toBe(expected);
});

test('calculates luminance for primary green', () => {
  const expected = LUMINANCE_GREEN_WEIGHT * 255;
  expect(luminanceFromRGB(0, 255, 0)).toBe(expected);
});

test('calculates luminance for primary blue', () => {
  const expected = LUMINANCE_BLUE_WEIGHT * 255;
  expect(luminanceFromRGB(0, 0, 255)).toBe(expected);
});

test('handles arbitrary RGB values', () => {
  const r = 123;
  const g = 45;
  const b = 200;
  const expected =
    LUMINANCE_RED_WEIGHT * r +
    LUMINANCE_GREEN_WEIGHT * g +
    LUMINANCE_BLUE_WEIGHT * b;
  expect(luminanceFromRGB(r, g, b)).toBe(expected);
});
