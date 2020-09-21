/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint global-require: 0 */
import $ from 'jquery';
import { SupersetClient } from '@superset-ui/core';
import getClientErrorObject, {
  ClientErrorObject,
} from '../utils/getClientErrorObject';
import setupErrorMessages from './setupErrorMessages';

function showApiMessage(resp: ClientErrorObject) {
  const template =
    '<div class="alert"> ' +
    '<button type="button" class="close" ' +
    'data-dismiss="alert">\xD7</button> </div>';
  const severity = resp.severity || 'info';
  $(template)
    .addClass(`alert-${severity}`)
    .append(resp.message || '')
    .appendTo($('#alert-container'));
}

function toggleCheckbox(apiUrlPrefix: string, selector: string) {
  SupersetClient.get({
    endpoint: apiUrlPrefix + ($(selector)[0] as HTMLInputElement).checked,
  })
    .then(() => undefined)
    .catch(response =>
      getClientErrorObject(response).then(parsedResp => {
        if (parsedResp && parsedResp.message) {
          showApiMessage(parsedResp);
        }
      }),
    );
}

export default function setupApp() {
  $(document).ready(function () {
    $(':checkbox[data-checkbox-api-prefix]').change(function (
      this: HTMLElement,
    ) {
      const $this = $(this);
      const prefix = $this.data('checkbox-api-prefix');
      const id = $this.attr('id');
      toggleCheckbox(prefix, `#${id}`);
    });

    // for language picker dropdown
    $('#language-picker a').click(function (
      ev: JQuery.ClickEvent<
        HTMLLinkElement,
        null,
        HTMLLinkElement,
        HTMLLinkElement
      >,
    ) {
      ev.preventDefault();
      SupersetClient.get({
        url: ev.currentTarget.href,
        parseMethod: null,
      }).then(() => {
        window.location.reload();
      });
    });
  });

  // A set of hacks to allow apps to run within a FAB template
  // this allows for the server side generated menus to function
  window.$ = $;
  window.jQuery = $;
  require('bootstrap');

  // setup appwide custom error messages
  setupErrorMessages();
}
