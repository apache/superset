/* eslint no-console: 0 */
import Translator, { TranslatorConfig } from './Translator';

let singleton: Translator;
let isConfigured = false;

function configure(config?: TranslatorConfig) {
  singleton = new Translator(config);
  isConfigured = true;

  return singleton;
}

function getInstance() {
  if (!isConfigured) {
    console.warn('You must call configure(...) before calling other methods');
    if (!singleton) {
      singleton = new Translator();
    }
  }

  return singleton;
}

function t(input: string, ...args: any[]) {
  return getInstance().translate(input, ...args);
}

function tn(singular: string, plural: string, ...args: any[]) {
  return getInstance().translateWithNumber(singular, plural, ...args);
}

export { configure, t, tn };
