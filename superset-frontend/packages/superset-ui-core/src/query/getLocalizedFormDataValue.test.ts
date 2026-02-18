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
import getLocalizedFormDataValue from './getLocalizedFormDataValue';

const TRANSLATIONS = {
  x_axis_title: { de: 'X-Achse', fr: 'Axe X', 'de-DE': 'X-Achse (DE)' },
  y_axis_title: { ru: 'Ось Y' },
};

test('returns undefined when translations is undefined', () => {
  expect(getLocalizedFormDataValue(undefined, 'x_axis_title', 'de')).toBeUndefined();
});

test('returns undefined when locale is undefined', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'x_axis_title', undefined)).toBeUndefined();
});

test('returns undefined when field has no translations', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'subtitle', 'de')).toBeUndefined();
});

test('returns undefined when locale has no translation for field', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'y_axis_title', 'de')).toBeUndefined();
});

test('returns exact locale match', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'x_axis_title', 'de')).toBe('X-Achse');
});

test('returns exact regional locale match when available', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'x_axis_title', 'de-DE')).toBe('X-Achse (DE)');
});

test('falls back to base language when regional locale has no match', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'x_axis_title', 'fr-CA')).toBe('Axe X');
});

test('returns undefined when neither regional nor base locale matches', () => {
  expect(getLocalizedFormDataValue(TRANSLATIONS, 'x_axis_title', 'ja-JP')).toBeUndefined();
});

test('returns undefined for empty translations object', () => {
  expect(getLocalizedFormDataValue({}, 'x_axis_title', 'de')).toBeUndefined();
});

test('returns undefined for empty field translations', () => {
  expect(getLocalizedFormDataValue({ x_axis_title: {} }, 'x_axis_title', 'de')).toBeUndefined();
});
