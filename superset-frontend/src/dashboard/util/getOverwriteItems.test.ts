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

import getOverwriteItems from './getOverwriteItems';
import { OVERWRITE_INSPECT_FIELDS } from 'src/dashboard/constants';

test('OVERWRITE_INSPECT_FIELDS includes translations', () => {
  expect(OVERWRITE_INSPECT_FIELDS).toContain('translations');
});

test('returns diff for translations object changes', () => {
  const prevTranslations = {
    dashboard_title: { de: 'Altes Dashboard' },
  };
  const nextTranslations = {
    dashboard_title: { de: 'Neues Dashboard', fr: 'Nouveau tableau' },
  };

  const prevValue = {
    css: '',
    json_metadata: JSON.stringify({ filter_scopes: {} }),
    translations: prevTranslations,
  };

  const nextValue = {
    css: '',
    json_metadata: JSON.stringify({ filter_scopes: {} }),
    translations: nextTranslations,
  };

  const result = getOverwriteItems(prevValue, nextValue);

  expect(result).toContainEqual({
    keyPath: 'translations',
    oldValue: JSON.stringify(prevTranslations, null, 2),
    newValue: JSON.stringify(nextTranslations, null, 2),
  });
});

test('excludes translations when unchanged', () => {
  const translations = { dashboard_title: { de: 'Dashboard' } };

  const prevValue = {
    css: 'old',
    json_metadata: JSON.stringify({ filter_scopes: {} }),
    translations,
  };

  const nextValue = {
    css: 'new',
    json_metadata: JSON.stringify({ filter_scopes: {} }),
    translations: { ...translations },
  };

  const result = getOverwriteItems(prevValue, nextValue);

  expect(result.find(item => item.keyPath === 'translations')).toBeUndefined();
  expect(result.find(item => item.keyPath === 'css')).toBeDefined();
});

test('returns diff items', () => {
  const prevFilterScopes = {
    filter1: {
      scope: ['abc'],
      immune: [],
    },
  };
  const nextFilterScopes = {
    scope: ['ROOT_ID'],
    immune: ['efg'],
  };

  const prevValue = {
    css: '',
    json_metadata: JSON.stringify({
      filter_scopes: prevFilterScopes,
      default_filters: {},
    }),
  };

  const nextValue = {
    css: '.updated_css {color: white;}',
    json_metadata: JSON.stringify({
      filter_scopes: nextFilterScopes,
      default_filters: {},
    }),
  };
  expect(getOverwriteItems(prevValue, nextValue)).toEqual([
    { keyPath: 'css', newValue: nextValue.css, oldValue: prevValue.css },
    {
      keyPath: 'json_metadata.filter_scopes',
      newValue: JSON.stringify(nextFilterScopes, null, 2),
      oldValue: JSON.stringify(prevFilterScopes, null, 2),
    },
  ]);
});
