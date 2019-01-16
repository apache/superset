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
import srcdoc from 'srcdoc-polyfill';
import './markup.css';

function markupWidget(slice, payload) {
  const { selector } = slice;
  const height = slice.height();
  const headerHeight = slice.headerHeight();
  const vizType = slice.props.vizType;
  const { data } = payload;

  const container = document.querySelector(selector);
  container.style.overflow = 'auto';

  // markup height is slice height - (marginTop + marginBottom)
  const iframeHeight = vizType === 'separator'
    ? height - 20
    : height + headerHeight;

  const html = `
    <html>
      <head>
        ${data.theme_css.map(
          href => `<link rel="stylesheet" type="text/css" href="${href}" />`,
        )}
      </head>
      <body style="background-color: transparent;">
        ${data.html}
      </body>
    </html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('frameborder', 0);
  iframe.setAttribute('height', iframeHeight);
  iframe.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation');
  container.appendChild(iframe);

  srcdoc.set(iframe, html);
}

export default markupWidget;
