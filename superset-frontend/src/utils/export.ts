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
import parseCookie from 'src/utils/parseCookie';
import rison from 'rison';
import { nanoid } from 'nanoid';

export default function handleResourceExport(
  resource: string,
  ids: number[],
  done: () => void,
  interval = 200,
): void {
  const token = nanoid();
  const url = `/api/v1/${resource}/export/?q=${rison.encode(
    ids,
  )}&token=${token}`;

  // create new iframe for export
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  const timer = window.setInterval(() => {
    const cookie: { [cookieId: string]: string } = parseCookie();
    if (cookie[token] === 'done') {
      window.clearInterval(timer);
      document.body.removeChild(iframe);
      done();
    }
  }, interval);
}
