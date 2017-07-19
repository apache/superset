
const $ = window.$ = require('jquery');

export function getLanguage() {
  function getLocale() {
    const locale = $.ajax({
      url: '/superset/rest/api/getLocale',
      async: false,
    });
    return locale.responseText;
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

export function getTranslate() {
  const translate = $.ajax({
    url: '/superset/rest/api/getTranslate',
    async: false,
  });
  console.log(translate);
  console.log(translate.responseText);
  return translate.responseText;
}
