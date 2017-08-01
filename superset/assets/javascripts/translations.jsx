/* eslint-disable global-require, import/no-dynamic-require */
import { getLanguage } from './explore/stores/getLanguage';

function dirnameToLocale(dirName) {
  let reDirName = dirName;
  if (dirName.indexOf('_') >= 0) {
    const localeArray = dirName.split('_');
    reDirName = localeArray[0] + '-' + localeArray[1].toLowerCase();
  }
  return reDirName;
}

export const translations = (function () {
  const ctx = require(`../../translations/${getLanguage()}/LC_MESSAGES/messages.po`);
  const rv = {};
  rv[dirnameToLocale(getLanguage())] = ctx;
  return rv;
}());

const defaultLanguage = 'en';

export function getTranslations(language) {
  return translations[language] || translations[defaultLanguage];
}

export function translationsExist(language) {
  return translations[language] !== undefined;
}
