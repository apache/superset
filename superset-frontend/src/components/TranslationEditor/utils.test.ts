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

import type { Translations } from 'src/types/Localization';
import { stripEmptyValues, countFieldTranslations, DEFAULT_LOCALE_KEY } from './utils';

// =============================================================================
// DEFAULT_LOCALE_KEY
// =============================================================================

test('DEFAULT_LOCALE_KEY is "default"', () => {
  expect(DEFAULT_LOCALE_KEY).toBe('default');
});

// =============================================================================
// stripEmptyValues
// =============================================================================

test('stripEmptyValues removes empty-string values', () => {
  const input: Translations = {
    dashboard_title: { de: 'Titel', fr: '' },
  };
  expect(stripEmptyValues(input)).toEqual({
    dashboard_title: { de: 'Titel' },
  });
});

test('stripEmptyValues drops field when all values are empty', () => {
  const input: Translations = {
    dashboard_title: { de: '', fr: '' },
    description: { de: 'Beschreibung' },
  };
  expect(stripEmptyValues(input)).toEqual({
    description: { de: 'Beschreibung' },
  });
});

test('stripEmptyValues returns empty object when all translations empty', () => {
  const input: Translations = {
    dashboard_title: { de: '' },
  };
  expect(stripEmptyValues(input)).toEqual({});
});

test('stripEmptyValues preserves all non-empty values', () => {
  const input: Translations = {
    dashboard_title: { de: 'Titel', fr: 'Titre' },
    description: { de: 'Beschreibung' },
  };
  expect(stripEmptyValues(input)).toEqual(input);
});

test('stripEmptyValues handles empty input', () => {
  expect(stripEmptyValues({})).toEqual({});
});

test('stripEmptyValues does not mutate source', () => {
  const input: Translations = {
    dashboard_title: { de: 'Titel', fr: '' },
  };
  const frozen = JSON.parse(JSON.stringify(input));
  stripEmptyValues(input);
  expect(input).toEqual(frozen);
});

test('stripEmptyValues preserves whitespace-only strings as non-empty', () => {
  const input: Translations = {
    dashboard_title: { de: '  ' },
  };
  expect(stripEmptyValues(input)).toEqual({
    dashboard_title: { de: '  ' },
  });
});

// =============================================================================
// countFieldTranslations
// =============================================================================

test('countFieldTranslations counts non-empty values for field', () => {
  const translations: Translations = {
    dashboard_title: { de: 'Titel', fr: 'Titre', es: '' },
  };
  expect(countFieldTranslations(translations, 'dashboard_title')).toBe(2);
});

test('countFieldTranslations returns 0 for missing field', () => {
  expect(countFieldTranslations({}, 'dashboard_title')).toBe(0);
});

test('countFieldTranslations returns 0 when all values empty', () => {
  const translations: Translations = {
    dashboard_title: { de: '', fr: '' },
  };
  expect(countFieldTranslations(translations, 'dashboard_title')).toBe(0);
});

test('countFieldTranslations counts all when none empty', () => {
  const translations: Translations = {
    dashboard_title: { de: 'Titel', fr: 'Titre', pt: 'Painel' },
  };
  expect(countFieldTranslations(translations, 'dashboard_title')).toBe(3);
});

test('countFieldTranslations ignores other fields', () => {
  const translations: Translations = {
    dashboard_title: { de: 'Titel' },
    description: { de: 'Beschreibung', fr: 'Description' },
  };
  expect(countFieldTranslations(translations, 'dashboard_title')).toBe(1);
});
