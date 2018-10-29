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

export default function toggleCheckbox(apiUrlPrefix, selector) {
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
