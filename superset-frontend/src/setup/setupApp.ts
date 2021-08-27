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
import { SupersetClient } from '@superset-ui/core';
import {
  getClientErrorObject,
  ClientErrorObject,
} from 'src/utils/getClientErrorObject';
import setupErrorMessages from 'src/setup/setupErrorMessages';

function showApiMessage(resp: ClientErrorObject) {
  const alertEl = document.createElement('div');
  alertEl.innerHTML = `
    <button type="button" class="close" data-dismiss="alert">\xD7</button>
    ${resp.message || ''}
  `;
  const severity = resp.severity || 'info';
  alertEl.classList.add('alert', `alert-${severity}`);
  document.getElementById('alert-container')?.appendChild(alertEl);
}

function toggleCheckbox(apiUrlPrefix: string, selector: string) {
  SupersetClient.get({
    endpoint:
      apiUrlPrefix +
      (document.querySelector(selector) as HTMLInputElement).checked,
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
  document.addEventListener('DOMContentLoaded', function () {
    const checkbox = document.querySelector<HTMLElement>(
      ':checkbox[data-checkbox-api-prefix]',
    );
    if (checkbox) {
      checkbox.addEventListener('change', function () {
        const prefix = checkbox.dataset['checkbox-api-prefix'];
        const id = checkbox.getAttribute('id');
        if (prefix && id) toggleCheckbox(prefix, `#${id}`);
      });
    }

    // for language picker dropdown
    const languagePicker = document.querySelector('#language-picker a');
    if (languagePicker) {
      languagePicker.addEventListener('click', function (ev) {
        ev.preventDefault();
        SupersetClient.get({
          url: (ev.currentTarget as HTMLAnchorElement).href,
          parseMethod: null,
        }).then(() => {
          window.location.reload();
        });
      });
    }
  });

  // setup appwide custom error messages
  setupErrorMessages();
}
