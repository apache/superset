/* eslint global-require: 0 */
import $ from 'jquery';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import { SupersetClient } from '@superset-ui/core';
import { toggleCheckbox } from './modules/utils';
import setupClient from './setup/setupClient';
import setupColors from './setup/setupColors';

$(document).ready(function () {
  $(':checkbox[data-checkbox-api-prefix]').change(function () {
    const $this = $(this);
    const prefix = $this.data('checkbox-api-prefix');
    const id = $this.attr('id');
    toggleCheckbox(prefix, '#' + id);
  });

  // for language picker dropdown
  $('#language-picker a').click(function (ev) {
    ev.preventDefault();
    SupersetClient.get({
      endpoint: ev.currentTarget.getAttribute('href'),
      parseMethod: null,
    })
      .then(() => {
        location.reload();
      });
  });
});

export function appSetup() {
  setupClient();
  setupColors();

  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');
}
