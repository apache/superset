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
import { useSyncExternalStore } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import ExtensionsLoader from './ExtensionsLoader';

/**
 * Host-internal only (not part of the @apache-superset/core extension-author
 * API): whether extension loading has settled, so UI that reads contributed
 * menus/views/commands — e.g. the sqllab.newTab dropdown — can distinguish
 * "still loading" (show a spinner, don't fall back yet) from "loaded, and
 * there's genuinely nothing registered" (the fallback is correct).
 *
 * When the EnableExtensions feature flag is off, ExtensionsStartup never
 * calls initializeExtensions() at all, so there's nothing to wait for —
 * this returns true immediately in that case rather than reporting an
 * indefinite pending state.
 */
export function useExtensionsReady(): boolean {
  return useSyncExternalStore(
    onChange => ExtensionsLoader.getInstance().onReady(onChange),
    () =>
      !isFeatureEnabled(FeatureFlag.EnableExtensions) ||
      ExtensionsLoader.getInstance().isReady(),
  );
}
