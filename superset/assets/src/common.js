/* eslint global-require: 0, no-console: 0 */
import $ from 'jquery';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import { SupersetClient } from '@superset-ui/core';
import { toggleCheckbox } from './modules/utils';
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

    SupersetClient.get({ endpoint: ev.currentTarget.href })
      .then(() => {
        location.reload();
      });
  });
});

setupColors();

export function appSetup() {
  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');

  const csrfNode = document.querySelector('#csrf_token');
  const csrfToken = csrfNode ? csrfNode.value : null;

  SupersetClient.configure({
    protocol: (window.location && window.location.protocol) || '',
    host: (window.location && window.location.host) || '',
    csrfToken,
  })
    .init()
    .catch((error) => {
      console.warn('Error initializing SupersetClient', error);
    });
}
