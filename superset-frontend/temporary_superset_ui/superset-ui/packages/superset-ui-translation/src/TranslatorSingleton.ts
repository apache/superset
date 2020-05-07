/* eslint no-console: 0 */

import Translator from './Translator';
import { TranslatorConfig } from './types';

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

function t(input: string, ...args: unknown[]) {
  return getInstance().translate(input, ...args);
}

function tn(singular: string, plural: string, num?: number, ...args: unknown[]) {
  return getInstance().translateWithNumber(singular, plural, num, ...args);
}

export { configure, t, tn };
