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
      expect.stringMatching(/was called before configure\(\)/),
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
      expect.stringMatching(/was called before configure\(\)/),
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

test('pre-configure warning fires once per unique key', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { t } = require('./TranslatorSingleton');
    t('apple');
    t('apple');
    t('apple');
    t('banana');
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"apple"'),
    );
    expect(consoleSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"banana"'),
    );
    consoleSpy.mockRestore();
  });
});

test('pre-configure warning suggests the lazy-function fix', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { t } = require('./TranslatorSingleton');
    t('Sort ascending');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('() => t("Sort ascending")'),
    );
    consoleSpy.mockRestore();
  });
});

test('pre-configure warning is suppressed in production', () => {
  jest.isolateModules(() => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { t } = require('./TranslatorSingleton');
    t('hello');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});

test('resetTranslation clears the warned-keys dedupe set', () => {
  jest.isolateModules(() => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { t, resetTranslation } = require('./TranslatorSingleton');
    t('hello');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    resetTranslation();
    t('hello');
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
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
      expect.stringMatching(/was called before configure\(\)/),
    );
    consoleSpy.mockRestore();
  });
});
