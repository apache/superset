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
import Handlebars from 'handlebars';
import {
  registerHandlebarsHelpers,
  resetHandlebarsHelpersRegistration,
} from '../../src/components/Handlebars/registerHandlebarsHelpers';

describe('registerHandlebarsHelpers', () => {
  beforeEach(() => {
    resetHandlebarsHelpersRegistration();
    registerHandlebarsHelpers();
  });

  test('t helper translates strings from the Superset language pack', () => {
    const { configure, addTranslation } = jest.requireActual(
      '@apache-superset/core/translation',
    );
    configure();
    addTranslation('Conversion Rate', ['Taux de conversion']);

    const template = Handlebars.compile('<span>{{t "Conversion Rate"}}</span>');
    expect(template({})).toBe('<span>Taux de conversion</span>');
  });

  test('t helper returns the key when no translation exists', () => {
    const template = Handlebars.compile('{{t "Unknown KPI label"}}');
    expect(template({})).toBe('Unknown KPI label');
  });

  test('t helper returns empty string for missing keys', () => {
    const template = Handlebars.compile('{{t missingKey}}');
    expect(template({ missingKey: undefined })).toBe('');
  });

  test('formatNumber helper applies d3 number formats', () => {
    const template = Handlebars.compile('{{formatNumber value format=",.2f"}}');
    expect(template({ value: 1234567.891 })).toBe('1,234,567.89');
  });

  test('formatNumber helper formats integers with comma grouping', () => {
    const template = Handlebars.compile('{{formatNumber value format=",d"}}');
    expect(template({ value: 1234567 })).toBe('1,234,567');
  });

  test('tn helper returns a string for pluralized keys', () => {
    const { configure } = jest.requireActual(
      '@apache-superset/core/translation',
    );
    configure();

    const template = Handlebars.compile('{{tn "item" count}}');
    expect(typeof template({ count: 2 })).toBe('string');
  });
});
