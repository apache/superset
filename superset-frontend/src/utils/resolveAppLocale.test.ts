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
import { normalizeLocale, resolveAppLocale } from './resolveAppLocale';
import { getUrlParam } from './urlUtils';

jest.mock('./urlUtils', () => ({
  getUrlParam: jest.fn(),
}));

const getUrlParamMock = getUrlParam as jest.Mock;

test('normalizeLocale maps react-i18next codes to Superset codes', () => {
  expect(normalizeLocale('fr-FR')).toBe('fr');
  expect(normalizeLocale('de')).toBe('de');
  expect(normalizeLocale('pt-BR')).toBe('pt_BR');
  expect(normalizeLocale('zh-TW')).toBe('zh_TW');
});

test('resolveAppLocale prefers the lang URL param over bootstrap locale', () => {
  getUrlParamMock.mockReturnValue('fr');
  expect(resolveAppLocale('en')).toBe('fr');
});

test('resolveAppLocale falls back to bootstrap locale', () => {
  getUrlParamMock.mockReturnValue(null);
  expect(resolveAppLocale('de')).toBe('de');
});
