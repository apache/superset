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
import Mustache from 'mustache';

export default function iframeWidget(slice) {
  const { selector, formData } = slice;
  const { url } = formData;
  const width = slice.width();
  const height = slice.height();
  const container = document.querySelector(selector);

  const completedUrl = Mustache.render(url, {
    width,
    height,
  });

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = height;
  iframe.setAttribute('src', completedUrl);
  container.appendChild(iframe);
}
