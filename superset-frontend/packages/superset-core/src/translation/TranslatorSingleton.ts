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

/* eslint no-console: 0 */

import Translator from './Translator';
import { TranslatorConfig, Translations, LocaleData } from './types';

let singleton: Translator | undefined;
let isConfigured = false;

// Tracks which keys have already triggered a pre-configure warning so the
// logs don't drown in repeated calls from large module-load fan-outs.
const warnedPreConfigureKeys = new Set<string>();

function configure(config?: TranslatorConfig) {
  singleton = new Translator(config);
  isConfigured = true;

  return singleton;
}

function getInstance() {
  if (typeof singleton === 'undefined') {
    singleton = new Translator();
  }

  return singleton;
}

function warnPreConfigure(key: string) {
  // Only warn in non-production builds — production callers may legitimately
  // tolerate the fallback, and the noise isn't useful at runtime.
  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'production'
  ) {
    return;
  }
  if (warnedPreConfigureKeys.has(key)) return;
  warnedPreConfigureKeys.add(key);
  console.warn(
    `[i18n] t(${JSON.stringify(key)}) was called before configure() — ` +
      `the result is the fallback language and will not update when the ` +
      `user switches language. If this call is at module load (e.g., a ` +
      `controlPanel \`label\`/\`description\`), wrap it in an arrow ` +
      `function: \`() => t(${JSON.stringify(key)})\`.`,
  );
}

function resetTranslation() {
  if (isConfigured) {
    isConfigured = false;
    singleton = undefined;
  }
  warnedPreConfigureKeys.clear();
}

function addTranslation(key: string, translations: string[]) {
  return getInstance().addTranslation(key, translations);
}

function addTranslations(translations: Translations) {
  return getInstance().addTranslations(translations);
}

function addLocaleData(data: LocaleData) {
  return getInstance().addLocaleData(data);
}

function t(input: string, ...args: unknown[]) {
  if (!isConfigured) warnPreConfigure(input);
  return getInstance().translate(input, ...args);
}

function tn(key: string, ...args: unknown[]) {
  if (!isConfigured) warnPreConfigure(key);
  return getInstance().translateWithNumber(key, ...args);
}

export {
  configure,
  addTranslation,
  addTranslations,
  addLocaleData,
  t,
  tn,
  resetTranslation,
};
