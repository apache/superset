
import zh_CN from '../stores/zh_CN';
import en_US from '../stores/en_US';
const $ = window.$ = require('jquery'); // eslint-disable-line

export function chooseMessage() {

  function getLocale() {
    const locale = $.ajax({
      url: '/superset/rest/api/getLocale',
      async: false,
    });
    return locale.responseText
  }
  switch (getLocale()) {
    case 'en':
      return en_US;
    case 'zh':
      return zh_CN;
    default:
      return en_US;
  }
}
