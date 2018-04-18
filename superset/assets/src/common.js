/* eslint-disable global-require */
import $ from 'jquery';

const utils = require('./modules/utils');

$(document).ready(function () {
  $(':checkbox[data-checkbox-api-prefix]').change(function () {
    const $this = $(this);
    const prefix = $this.data('checkbox-api-prefix');
    const id = $this.attr('id');
    utils.toggleCheckbox(prefix, '#' + id);
  });

  // for language picker dropdown
  $('#language-picker a').click(function (ev) {
    ev.preventDefault();

    const targetUrl = ev.currentTarget.href;
    $.ajax(targetUrl)
      .then(() => {
        location.reload();
      });
  });
});

export function appSetup() {
  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');
}
