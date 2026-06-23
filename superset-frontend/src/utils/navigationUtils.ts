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
  // encodeURI is a CodeQL-recognised sanitiser for DOM navigation sinks.
  const target = encodeURI(ensureAppRoot(url));
  if (options?.newWindow) {
    window.open(target, '_blank', 'noopener noreferrer');
  } else if (options?.assign) {
    window.location.assign(target);
  } else {
    window.location.href = target;
  }
};

export const navigateWithState = (
  url: string,
  state: Record<string, unknown>,
  options?: { replace?: boolean },
) => {
  const target = encodeURI(ensureAppRoot(url));
  if (options?.replace) {
    window.history.replaceState(state, '', target);
  } else {
    window.history.pushState(state, '', target);
  }
};
