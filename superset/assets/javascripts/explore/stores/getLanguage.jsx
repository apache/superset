
const $ = window.$ = require('jquery');

export function getLanguage() {
  let defaultLocale = 'en';
  $.ajax({
    url: '/superset/rest/api/get_locale',
    async: false,
    success(data) {
      defaultLocale = data.language;
    },
  });
  return defaultLocale;
}
