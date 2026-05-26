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

export const VERSION_URL_PARAM = 'version_uuid';

/**
 * Strips ``?version_uuid=...`` from the current URL synchronously and
 * triggers a full page reload. Used after a successful restore so the
 * reloaded page does not re-enter preview of the version that was just
 * restored (the URL-write effect in VersionHistoryProvider runs after
 * React commits, which loses the race against ``location.reload()``).
 */
export function reloadStrippingVersionUuid(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(VERSION_URL_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // ignore — worst case the reload still happens with the stale param
  }
  window.location.reload();
}
