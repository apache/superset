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
import UntypedJed from 'jed';
import logging from '../utils/logging';
import {
  Jed,
  TranslatorConfig,
  Locale,
  Translations,
  LocaleData,
  LanguagePack,
} from './types';

const DEFAULT_LANGUAGE_PACK: LanguagePack = {
  domain: 'superset',
  locale_data: {
    superset: {
      '': {
        domain: 'superset',
        lang: 'en',
        plural_forms: 'nplurals=2; plural=(n != 1)',
      },
    },
  },
};

export default class Translator {
  i18n: Jed;

  locale: Locale;

  constructor(config: TranslatorConfig = {}) {
    const { languagePack = DEFAULT_LANGUAGE_PACK } = config;
    this.i18n = new UntypedJed(languagePack) as Jed;
    this.locale = this.i18n.options.locale_data.superset[''].lang as Locale;
  }

  /**
   * Add additional translations on the fly, used by plugins.
   */
  addTranslation(key: string, texts: ReadonlyArray<string>) {
    const translations = this.i18n.options.locale_data.superset;
    if (key in translations) {
      logging.warn(`Duplicate translation key "${key}", will override.`);
    }
    translations[key] = texts;
  }

  /**
   * Add a series of translations.
   */
  addTranslations(translations: Translations) {
    if (translations && !Array.isArray(translations)) {
      Object.entries(translations).forEach(([key, vals]) =>
        this.addTranslation(key, vals),
      );
    } else {
      logging.warn('Invalid translations');
    }
  }

  addLocaleData(data: LocaleData) {
    // always fallback to English
    const translations = data?.[this.locale] || data?.en;
    if (translations) {
      this.addTranslations(translations);
    } else {
      logging.warn('Invalid locale data');
    }
  }

  translate(input: string, ...args: unknown[]): string {
    return this.i18n.translate(input).fetch(...args);
  }

  translateWithNumber(key: string, ...args: unknown[]): string {
    const [plural, num, ...rest] = args;
    if (typeof plural === 'number') {
      return this.i18n
        .translate(key)
        .ifPlural(plural, key)
        .fetch(plural, num, ...args);
    }
    return this.i18n
      .translate(key)
      .ifPlural(num as number, plural as string)
      .fetch(...rest);
  }
}
