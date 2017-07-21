
const $ = window.$ = require('jquery');

export function getLanguage() {
  const locale = $.ajax({
    url: '/superset/rest/api/getLocale',
    async: false,
  });
  return JSON.parse(locale.responseText).language;
}
