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

// Each test uses jest.isolateModules to get a fresh module state
// (isConfigured = false, singleton = undefined) independent of other tests.

test('t() warns and creates a default translator when called before configure', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { t } = require('./TranslatorSingleton');
    const result = t('hello');
    expect(consoleSpy).toHaveBeenCalledWith(
      'You should call configure(...) before calling other methods',
    );
    expect(result).toBe('hello');
    consoleSpy.mockRestore();
  });
});

test('configure sets up the singleton and t() works without warnings', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { configure, t } = require('./TranslatorSingleton');
    configure();
    const result = t('hello');
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result).toBe('hello');
    consoleSpy.mockRestore();
  });
});

test('resetTranslation resets the configured singleton', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { configure, resetTranslation, t } = require('./TranslatorSingleton');
    configure();
    resetTranslation();
    // After reset, calling t() should warn again
    t('hello');
    expect(consoleSpy).toHaveBeenCalledWith(
      'You should call configure(...) before calling other methods',
    );
    consoleSpy.mockRestore();
  });
});

test('addTranslation adds a translation via the singleton', () => {
  jest.isolateModules(() => {
    const { configure, addTranslation, t } = require('./TranslatorSingleton');
    configure();
    addTranslation('greeting', ['Hello!']);
    expect(t('greeting')).toBe('Hello!');
  });
});

test('addTranslations adds multiple translations via the singleton', () => {
  jest.isolateModules(() => {
    const { configure, addTranslations, t } = require('./TranslatorSingleton');
    configure();
    addTranslations({ farewell: ['Goodbye!'] });
    expect(t('farewell')).toBe('Goodbye!');
  });
});

test('addLocaleData adds locale translations via the singleton', () => {
  jest.isolateModules(() => {
    const { configure, addLocaleData, t } = require('./TranslatorSingleton');
    configure();
    addLocaleData({ en: { locale_key: ['locale value'] } });
    expect(t('locale_key')).toBe('locale value');
  });
});

test('tn() calls translateWithNumber on the singleton', () => {
  jest.isolateModules(() => {
    const { configure, tn } = require('./TranslatorSingleton');
    configure();
    const result = tn('item', 1);
    expect(typeof result).toBe('string');
  });
});

test('resetTranslation does nothing when not yet configured', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { resetTranslation, t } = require('./TranslatorSingleton');
    // resetTranslation is a no-op when isConfigured is false
    resetTranslation();
    // The singleton is still unconfigured, so t() warns
    t('hello');
    expect(consoleSpy).toHaveBeenCalledWith(
      'You should call configure(...) before calling other methods',
    );
    consoleSpy.mockRestore();
  });
});
