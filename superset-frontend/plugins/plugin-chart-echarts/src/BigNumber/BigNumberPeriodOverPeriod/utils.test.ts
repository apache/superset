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
import { supersetTheme } from '@apache-superset/core/theme';
import {
  getComparisonColorTokens,
  getComparisonFontSize,
  getHeaderFontSize,
  resolveComparisonColorKeys,
} from './utils';

test('getHeaderFontSize', () => {
  expect(getHeaderFontSize(0.2)).toEqual(16);
  expect(getHeaderFontSize(0.3)).toEqual(20);
  expect(getHeaderFontSize(0.4)).toEqual(30);
  expect(getHeaderFontSize(0.5)).toEqual(48);
  expect(getHeaderFontSize(0.6)).toEqual(60);
  expect(getHeaderFontSize(0.15)).toEqual(60);
  expect(getHeaderFontSize(2)).toEqual(60);
});

test('getComparisonFontSize', () => {
  expect(getComparisonFontSize(0.125)).toEqual(16);
  expect(getComparisonFontSize(0.15)).toEqual(20);
  expect(getComparisonFontSize(0.2)).toEqual(26);
  expect(getComparisonFontSize(0.3)).toEqual(32);
  expect(getComparisonFontSize(0.4)).toEqual(40);
  expect(getComparisonFontSize(0.05)).toEqual(40);
  expect(getComparisonFontSize(0.9)).toEqual(40);
});

test('resolveComparisonColorKeys defaults to Green/Red when nothing is set', () => {
  expect(resolveComparisonColorKeys(undefined, undefined, undefined)).toEqual({
    increaseColor: 'Green',
    decreaseColor: 'Red',
  });
});

test('resolveComparisonColorKeys honors the new increase_color/decrease_color controls', () => {
  expect(resolveComparisonColorKeys(undefined, '#ff0000', '#00ff00')).toEqual({
    increaseColor: '#ff0000',
    decreaseColor: '#00ff00',
  });
});

test('resolveComparisonColorKeys falls back to the legacy Green comparison_color_scheme', () => {
  // legacy default: "Green for increase, red for decrease"
  expect(resolveComparisonColorKeys('Green', undefined, undefined)).toEqual({
    increaseColor: 'Green',
    decreaseColor: 'Red',
  });
});

test('resolveComparisonColorKeys reverses colors for the legacy Red comparison_color_scheme', () => {
  // legacy reversed choice: "Red for increase, green for decrease" -- this
  // is the case a naive default-to-Green migration would silently break.
  expect(resolveComparisonColorKeys('Red', undefined, undefined)).toEqual({
    increaseColor: 'Red',
    decreaseColor: 'Green',
  });
});

test('resolveComparisonColorKeys prefers the new fields over the legacy scheme when both are present', () => {
  expect(resolveComparisonColorKeys('Red', '#ff0000', undefined)).toEqual({
    increaseColor: '#ff0000',
    decreaseColor: 'Green',
  });
});

test('getComparisonColorTokens resolves the Green semantic token to theme success colors', () => {
  expect(getComparisonColorTokens('Green', supersetTheme)).toEqual({
    text: supersetTheme.colorSuccess,
    background: supersetTheme.colorSuccessBg,
    strongText: supersetTheme.colorSuccessText,
  });
});

test('getComparisonColorTokens resolves the Red semantic token to theme error colors', () => {
  expect(getComparisonColorTokens('Red', supersetTheme)).toEqual({
    text: supersetTheme.colorError,
    background: supersetTheme.colorErrorBg,
    strongText: supersetTheme.colorErrorText,
  });
});

test('getComparisonColorTokens treats any other value as a literal hex color', () => {
  expect(getComparisonColorTokens('#336699', supersetTheme)).toEqual({
    text: '#336699',
    background: '#3366991A',
    strongText: '#336699',
  });
});
