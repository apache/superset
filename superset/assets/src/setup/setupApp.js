/* eslint global-require: 0 */
import $ from 'jquery';
import { SupersetClient } from '@superset-ui/core';
import getClientErrorObject from '../utils/getClientErrorObject';

function showApiMessage(resp) {
  const template =
    '<div class="alert"> ' +
    '<button type="button" class="close" ' +
    'data-dismiss="alert">\xD7</button> </div>';
  const severity = resp.severity || 'info';
  $(template).addClass('alert-' + severity)
    .append(resp.message)
    .appendTo($('#alert-container'));
}

function toggleCheckbox(apiUrlPrefix, selector) {
  SupersetClient.get({ endpoint: apiUrlPrefix + $(selector)[0].checked })
    .then(() => {})
    .catch(response =>
      getClientErrorObject(response)
        .then((parsedResp) => {
          if (parsedResp && parsedResp.message) {
            showApiMessage(parsedResp);
          }
        }),
      );
}

export default function setupApp() {
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

  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');
}
