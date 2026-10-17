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
import { normalizeRgbaColor } from '../../src/utils/colors';

const fallback = { r: 1, g: 2, b: 3, a: 1 };

test('passes through an rgb object', () => {
  expect(normalizeRgbaColor({ r: 10, g: 20, b: 30, a: 0.5 }, fallback)).toEqual(
    { r: 10, g: 20, b: 30, a: 0.5 },
  );
});

test('parses 6 and 3 digit hex strings', () => {
  expect(normalizeRgbaColor('#336699', fallback)).toEqual({
    r: 51,
    g: 102,
    b: 153,
    a: 1,
  });
  expect(normalizeRgbaColor('#f00', fallback)).toEqual({
    r: 255,
    g: 0,
    b: 0,
    a: 1,
  });
});

test('falls back for undefined, semantic names and malformed values', () => {
  expect(normalizeRgbaColor(undefined, fallback)).toBe(fallback);
  expect(normalizeRgbaColor('Green', fallback)).toBe(fallback);
  expect(normalizeRgbaColor({ r: 1 }, fallback)).toBe(fallback);
});
