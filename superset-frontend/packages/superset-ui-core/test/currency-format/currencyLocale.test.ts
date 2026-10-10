/*
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
  getCurrencyLocale,
  setCurrencyLocale,
  resolveSymbolPosition,
} from '@superset-ui/core';

afterEach(() => {
  // Restore the default so other tests are not affected by the global locale.
  setCurrencyLocale('en-US');
});

test('currency locale defaults to en-US', () => {
  expect(getCurrencyLocale()).toEqual('en-US');
});

test('setCurrencyLocale updates the locale used to resolve unset positions', () => {
  setCurrencyLocale('fr-FR');
  expect(getCurrencyLocale()).toEqual('fr-FR');
  // EUR is a suffix in fr-FR.
  expect(resolveSymbolPosition('EUR')).toEqual('suffix');
});

test('setCurrencyLocale ignores empty values', () => {
  setCurrencyLocale('de-DE');
  setCurrencyLocale(undefined);
  setCurrencyLocale('');
  expect(getCurrencyLocale()).toEqual('de-DE');
});

test('setCurrencyLocale canonicalizes underscore-formatted locales to BCP-47', () => {
  // Superset bootstrap can emit underscore tags like `pt_BR`/`zh_TW`.
  setCurrencyLocale('pt_BR');
  expect(getCurrencyLocale()).toEqual('pt-BR');
  // BRL is a prefix in pt-BR; the placement must resolve instead of throwing
  // and falling back.
  expect(resolveSymbolPosition('BRL')).toEqual('prefix');

  setCurrencyLocale('zh_TW');
  expect(getCurrencyLocale()).toEqual('zh-TW');
});

test('setCurrencyLocale keeps the previous locale for invalid tags', () => {
  setCurrencyLocale('fr-FR');
  setCurrencyLocale('not a locale!');
  expect(getCurrencyLocale()).toEqual('fr-FR');
});
