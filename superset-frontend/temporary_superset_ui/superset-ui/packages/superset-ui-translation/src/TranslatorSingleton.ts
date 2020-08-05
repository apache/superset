/* eslint no-console: 0 */

import Translator from './Translator';
import { TranslatorConfig, Translations, LocaleData } from './types';

let singleton: Translator | undefined;
let isConfigured = false;

function configure(config?: TranslatorConfig) {
  singleton = new Translator(config);
  isConfigured = true;

  return singleton;
}

function getInstance() {
  if (!isConfigured) {
    console.warn('You should call configure(...) before calling other methods');
  }

  if (typeof singleton === 'undefined') {
    singleton = new Translator();
  }

  return singleton;
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
  return getInstance().translate(input, ...args);
}

function tn(key: string, ...args: unknown[]) {
  return getInstance().translateWithNumber(key, ...args);
}

export { configure, addTranslation, addTranslations, addLocaleData, t, tn };
