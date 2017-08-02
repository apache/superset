
const $ = require('jquery');

export function getLanguage() {
  const locale = $.ajax({
    url: '/superset/rest/api/get_locale',
    async: false,
  });
  return JSON.parse(locale.responseText).language;
}
