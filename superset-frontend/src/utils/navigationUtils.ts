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
import { ensureAppRoot } from './pathUtils';

export const navigateTo = (
  url: string,
  options?: { newWindow?: boolean; assign?: boolean },
) => {
  if (options?.newWindow) {
    window.open(ensureAppRoot(url), '_blank', 'noopener noreferrer');
  } else if (options?.assign) {
    window.location.assign(ensureAppRoot(url));
  } else {
    window.location.href = ensureAppRoot(url);
  }
};

export const navigateWithState = (
  url: string,
  state: Record<string, unknown>,
  options?: { replace?: boolean },
) => {
  if (options?.replace) {
    window.history.replaceState(state, '', ensureAppRoot(url));
  } else {
    window.history.pushState(state, '', ensureAppRoot(url));
  }
};
