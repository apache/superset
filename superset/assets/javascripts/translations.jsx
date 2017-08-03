/* eslint-disable global-require, import/no-dynamic-require */
import { getLanguage } from './explore/stores/getLanguage';

export const translations = (function () {
  const ctx = require(`../../translations/${getLanguage()}/LC_MESSAGES/messages.po`);
  const rv = {};
  rv[getLanguage()] = ctx;
  return rv;
}());

const defaultLanguage = 'en';

export function getTranslations(language) {
  return translations[language] || translations[defaultLanguage];
}

export function translationsExist(language) {
  return translations[language] !== undefined;
}
