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
import { Jed as BaseJed, JedOptions, DomainData, Translations } from './jed';

export * from './jed';
export { default as __hack_reexport_jed } from './jed';

/**
 * Superset supported languages.
 */
export type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'ja' | 'ko' | 'pt' | 'pt_BR' | 'ru' | 'zh'; // supported locales in Superset

/**
 * Language pack provided to `jed`.
 */
export type LanguagePack = JedOptions & {
  // eslint-disable-next-line camelcase
  locale_data: {
    superset: DomainData & {
      '': {
        domain: 'superset';
        lang: Locale;
        // eslint-disable-next-line camelcase
        plural_forms: string;
      };
    };
  };
};

export interface Jed extends BaseJed {
  options: LanguagePack;
}

/**
 * Config options for Translator class.
 */
export interface TranslatorConfig {
  languagePack?: LanguagePack;
}

/**
 * Key-value mapping of translation key and the translations.
 */
export type LocaleData = Partial<Record<Locale, Translations>>;

export default {};
