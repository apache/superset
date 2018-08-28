/* eslint-disable global-require */
import $ from 'jquery';
import { SupersetClient } from '@superset/core'; // eslint-disable-line import/no-extraneous-dependencies
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';

import { t } from './locales';

const utils = require('./modules/utils');

document.addEventListener('DOMContentLoaded', () => {
  $(':checkbox[data-checkbox-api-prefix]').change(function () {
    const $this = $(this);
    const prefix = $this.data('checkbox-api-prefix');
    const id = $this.attr('id');
    utils.toggleCheckbox(prefix, '#' + id);
  });

  // for language picker dropdown
  const languagePickerLinks = document.querySelectorAll('#language-picker a');

  languagePickerLinks.forEach((elem) => {
    elem.addEventListener('click', (event) => {
      event.preventDefault();
      const client = SupersetClient.getInstance();
      const currLocation = location.href;

      // this seems to be called twice (jQuery thing? the second time it's not authenticated)
      if (client.authorized()) {
        client.get({ url: event.currentTarget.href }).then(() => {
          location = currLocation;
        });
      }
    });
  });
});

export function appSetup() {
  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');

  // configure and initialize the JS client which makes all requests, handles auth, etc.
  const client = SupersetClient.getInstance({
    host: window.location && window.location.host,
  });

  client.init();
}

// Error messages used in many places across applications
export const COMMON_ERR_MESSAGES = {
  SESSION_TIMED_OUT: t('Your session timed out, please refresh your page and try again.'),
};
