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

import { configure, t as translate, tn as translateN } from '@apache-superset/core/ui';
import type { LanguagePack } from '@apache-superset/core/ui';
import { SupersetClient } from '@superset-ui/core';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import { logging } from '@apache-superset/core';

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

export interface LocaleControllerOptions {
  /** Initial locale code (e.g., 'en', 'ru', 'de') */
  initialLocale?: string;
  /** Callback invoked when locale changes */
  onChange?: (locale: string) => void;
  /** Skip initial language pack fetch (for cases when it's already loaded) */
  skipInitialFetch?: boolean;
}

/**
 * LocaleController manages application localization state reactively.
 *
 * This controller follows the same architectural pattern as ThemeController:
 * - Owns and manages locale state
 * - Notifies subscribers via onChange callbacks
 * - Does NOT reload the page
 * - Enables reactive updates in React via LocaleProvider
 *
 * Usage:
 * ```typescript
 * const controller = new LocaleController({ initialLocale: 'en' });
 *
 * // Subscribe to changes
 * controller.onChange(locale => console.log('Locale changed:', locale));
 *
 * // Change locale (fetches language pack, updates state, notifies listeners)
 * await controller.setLocale('ru');
 * ```
 */
export class LocaleController {
  private currentLocale: string;

  private onChangeCallbacks: Set<(locale: string) => void> = new Set();

  private isInitialized = false;

  private pendingLocaleChange: Promise<void> | null = null;

  constructor(options: LocaleControllerOptions = {}) {
    const { initialLocale = 'en', onChange, skipInitialFetch = false } = options;

    this.currentLocale = initialLocale;

    if (onChange) {
      this.onChangeCallbacks.add(onChange);
    }

    // If not skipping initial fetch and locale is not 'en', fetch language pack
    if (!skipInitialFetch && initialLocale !== 'en') {
      this.pendingLocaleChange = this.initializeLocale(initialLocale);
    } else if (skipInitialFetch) {
      // Mark as initialized if we're skipping fetch (e.g., preamble already loaded it)
      this.isInitialized = true;
    } else {
      // English locale - just configure with defaults
      configure();
      this.isInitialized = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the current locale code.
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Returns whether the controller has been initialized with a language pack.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Sets the application locale.
   *
   * This method:
   * 1. Fetches the language pack for the target locale
   * 2. Configures the translation singleton
   * 3. Updates dayjs locale
   * 4. Notifies all subscribers
   *
   * Does NOT reload the page - React components will re-render via LocaleProvider.
   *
   * @param locale - The locale code (e.g., 'en', 'ru', 'de')
   */
  async setLocale(locale: string): Promise<void> {
    // If same locale and already initialized, skip
    if (locale === this.currentLocale && this.isInitialized) {
      return;
    }

    // If there's a pending locale change, wait for it first
    if (this.pendingLocaleChange) {
      await this.pendingLocaleChange;
    }

    // Create new pending promise
    this.pendingLocaleChange = this.doSetLocale(locale);

    try {
      await this.pendingLocaleChange;
    } finally {
      this.pendingLocaleChange = null;
    }
  }

  /**
   * Translate a string using the current locale.
   * Delegates to the translation singleton.
   */
  t(key: string, ...args: unknown[]): string {
    return translate(key, ...args);
  }

  /**
   * Translate a string with pluralization.
   * Delegates to the translation singleton.
   */
  tn(key: string, ...args: unknown[]): string {
    return translateN(key, ...args);
  }

  /**
   * Subscribe to locale changes.
   *
   * @param callback - Function called when locale changes
   * @returns Unsubscribe function
   */
  onChange(callback: (locale: string) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  /**
   * Cleans up resources. Should be called when the controller is no longer needed.
   */
  destroy(): void {
    this.onChangeCallbacks.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize locale on controller construction.
   */
  private async initializeLocale(locale: string): Promise<void> {
    try {
      const languagePack = await this.fetchLanguagePack(locale);
      this.applyLocale(locale, languagePack);
    } catch (error) {
      logging.warn('Failed to initialize locale, falling back to English:', error);
      configure();
      this.currentLocale = 'en';
      this.isInitialized = true;
    }
  }

  /**
   * Internal implementation of setLocale.
   */
  private async doSetLocale(locale: string): Promise<void> {
    try {
      const languagePack = await this.fetchLanguagePack(locale);
      this.applyLocale(locale, languagePack);
    } catch (error) {
      logging.error('Failed to set locale:', error);
      throw error;
    }
  }

  /**
   * Fetches the language pack for a given locale from the server.
   */
  private async fetchLanguagePack(locale: string): Promise<LanguagePack> {
    if (locale === 'en') {
      return DEFAULT_LANGUAGE_PACK;
    }

    const { json } = await SupersetClient.get({
      endpoint: `/superset/language_pack/${locale}/`,
    });

    return json as LanguagePack;
  }

  /**
   * Applies the locale and language pack to the application.
   * Does NOT reload the page.
   */
  private applyLocale(locale: string, languagePack: LanguagePack): void {
    // Configure the translation singleton
    configure({ languagePack });

    // Update dayjs locale for date formatting
    dayjs.locale(locale);

    // Update internal state
    this.currentLocale = locale;
    this.isInitialized = true;

    // Notify all listeners (React components will re-render)
    this.notifyListeners();
  }

  /**
   * Notifies all registered callbacks about the locale change.
   */
  private notifyListeners(): void {
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(this.currentLocale);
      } catch (error) {
        logging.error('Error in locale change callback:', error);
      }
    });
  }
}
