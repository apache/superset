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
import getLocalizedAnnotationName from './getLocalizedAnnotationName';
import {
  AnnotationOpacity,
  AnnotationStyle,
  AnnotationType,
  FormulaAnnotationLayer,
} from './types/AnnotationLayer';

const BASE_LAYER: FormulaAnnotationLayer = {
  annotationType: AnnotationType.Formula,
  name: 'Revenue Target',
  opacity: AnnotationOpacity.Medium,
  show: true,
  showLabel: true,
  style: AnnotationStyle.Solid,
  value: 'x*2',
};

const LAYER_WITH_TRANSLATIONS: FormulaAnnotationLayer = {
  ...BASE_LAYER,
  translations: {
    name: {
      de: 'Umsatzziel',
      ru: 'Целевой доход',
      'de-DE': 'Umsatzziel (Deutschland)',
    },
  },
};

test('returns original name when no locale is provided', () => {
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, undefined)).toBe(
    'Revenue Target',
  );
});

test('returns original name when no translations exist', () => {
  expect(getLocalizedAnnotationName(BASE_LAYER, 'de')).toBe('Revenue Target');
});

test('returns localized name for exact locale match', () => {
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, 'de')).toBe(
    'Umsatzziel',
  );
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, 'ru')).toBe(
    'Целевой доход',
  );
});

test('returns exact regional locale match when available', () => {
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, 'de-DE')).toBe(
    'Umsatzziel (Deutschland)',
  );
});

test('falls back to base language for regional locale', () => {
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, 'de-AT')).toBe(
    'Umsatzziel',
  );
});

test('returns original name when locale has no matching translation', () => {
  expect(getLocalizedAnnotationName(LAYER_WITH_TRANSLATIONS, 'fr')).toBe(
    'Revenue Target',
  );
});

test('returns original name when translations object has no name field', () => {
  const layer: FormulaAnnotationLayer = {
    ...BASE_LAYER,
    translations: {},
  };
  expect(getLocalizedAnnotationName(layer, 'de')).toBe('Revenue Target');
});
