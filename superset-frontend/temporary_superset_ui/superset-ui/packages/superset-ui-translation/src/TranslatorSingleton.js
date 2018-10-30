/* eslint no-console: 0 */
import Translator from './Translator';

let singleton;
let isConfigured = false;

function configure(config) {
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

function t(...args) {
  return getInstance().translate(...args);
}

function tn(...args) {
  return getInstance().translateWithNumber(...args);
}

export { configure, t, tn };
