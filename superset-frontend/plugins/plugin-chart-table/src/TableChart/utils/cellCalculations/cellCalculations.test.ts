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
import { SupersetTheme } from '@apache-superset/core/ui';
import { cellWidth, cellOffset, cellBackground } from '.';

const mockTheme = {
  colorFill: '#f5f5f5',
  colorError: '#ff4d4f',
  colorSuccess: '#52c41a',
} as SupersetTheme;

test('cellWidth calculates width with alignPositiveNegative true', () => {
  const result = cellWidth({
    value: 50,
    valueRange: [0, 100],
    alignPositiveNegative: true,
  });
  expect(result).toBe(50);
});

test('cellWidth calculates width with alignPositiveNegative false and positive value', () => {
  const result = cellWidth({
    value: 50,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(25);
});

test('cellWidth calculates width with alignPositiveNegative false and negative value', () => {
  const result = cellWidth({
    value: -50,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(25);
});

test('cellWidth handles zero value', () => {
  const result = cellWidth({
    value: 0,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(0);
});

test('cellOffset returns 0 when alignPositiveNegative is true', () => {
  const result = cellOffset({
    value: 50,
    valueRange: [-100, 100],
    alignPositiveNegative: true,
  });
  expect(result).toBe(0);
});

test('cellOffset calculates offset with positive value', () => {
  const result = cellOffset({
    value: 50,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(50);
});

test('cellOffset calculates offset with negative value', () => {
  const result = cellOffset({
    value: -50,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(25);
});

test('cellOffset handles zero value', () => {
  const result = cellOffset({
    value: 0,
    valueRange: [-100, 100],
    alignPositiveNegative: false,
  });
  expect(result).toBe(50);
});

test('cellBackground returns neutral color when colorPositiveNegative is false', () => {
  const result = cellBackground({
    value: 50,
    colorPositiveNegative: false,
    theme: mockTheme,
  });
  expect(result).toBe('#f5f5f5');
});

test('cellBackground returns success color for positive value when colorPositiveNegative is true', () => {
  const result = cellBackground({
    value: 50,
    colorPositiveNegative: true,
    theme: mockTheme,
  });
  expect(result).toBe('#52c41a50');
});

test('cellBackground returns error color for negative value when colorPositiveNegative is true', () => {
  const result = cellBackground({
    value: -50,
    colorPositiveNegative: true,
    theme: mockTheme,
  });
  expect(result).toBe('#ff4d4f50');
});

test('cellBackground returns success color for zero value when colorPositiveNegative is true', () => {
  const result = cellBackground({
    value: 0,
    colorPositiveNegative: true,
    theme: mockTheme,
  });
  expect(result).toBe('#52c41a50');
});
