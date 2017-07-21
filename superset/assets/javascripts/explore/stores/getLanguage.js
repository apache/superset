
const $ = window.$ = require('jquery');

export function getLanguage() {
  function getLocale() {
    const locale = $.ajax({
      url: '/superset/rest/api/getLocale',
      async: false,
    });
    return JSON.parse(locale.responseText).language;
  }
  switch (getLocale()) {
    case 'en':
      return 'es';
    case 'fr':
      return 'fr';
    case 'it':
      return 'it';
    case 'zh':
      return 'zh';
    default:
      return 'es';
  }
}
