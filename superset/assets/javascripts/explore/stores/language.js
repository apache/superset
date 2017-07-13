
const $ = window.$ = require('jquery'); // eslint-disable-line

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
      return 'en_US';
    case 'zh':
      return 'zh_CN';
    default:
      return 'en_US';
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