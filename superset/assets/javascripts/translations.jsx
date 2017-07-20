import { _ } from 'underscore';
import info from '../../translations/catalogs.json';

const catalogs = (function () {
  return info.supported_locales;
}());

function dirnameToLocale(dirName) {
  let reDirName = dirName;
  if (dirName.indexOf('_') >= 0) {
    const localeArray = dirName.split('_');
    reDirName = localeArray[0] + '-' + localeArray[1].toLowerCase();
  }
  return reDirName;
}

export const translations = (function () {
  const ctx = require.context('../../translations/', true, /\.po$/);
  const rv = {};
  ctx.keys().forEach((translation) => {
    const langCode = translation.match(/([a-zA-Z_]+)/)[1];
    if (_.contains(catalogs, langCode)) {
      rv[dirnameToLocale(langCode)] = ctx(translation);
    }
  });
  return rv;
}());

const defaultLanguage = 'zh';

export function getTranslations(language) {
  return translations[language] || translations[defaultLanguage];
}

export function translationsExist(language) {
  return translations[language] !== undefined;
}
