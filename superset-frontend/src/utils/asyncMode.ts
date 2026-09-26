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
import { useSelector } from 'react-redux';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

/**
 * Per-dashboard async-mode override, stored in the dashboard's
 * `json_metadata.async_mode`. `default` (or absent) defers to the deployment
 * default; the others force async on/off for that dashboard's charts.
 */
export type AsyncModeOverride = 'default' | 'force_on' | 'force_off';

/** State shape the override is read from; matches any store holding dashboard info. */
export type StateWithAsyncModeOverride = {
  dashboardInfo?: { metadata?: { async_mode?: AsyncModeOverride } };
};

/**
 * Read the per-dashboard override from Redux. Undefined outside a dashboard (or
 * when the dashboard sets no override), which `resolveAsyncMode` treats as
 * `default`.
 */
export const selectAsyncModeOverride = (
  state: StateWithAsyncModeOverride,
): AsyncModeOverride | undefined => state.dashboardInfo?.metadata?.async_mode;

export const useAsyncModeOverride = (): AsyncModeOverride | undefined =>
  useSelector(selectAsyncModeOverride);

/**
 * Resolve whether the UI should request asynchronous chart-data execution.
 *
 * Async is opt-in per request (the server treats an absent flag as synchronous).
 * The frontend resolves the flag it sends via a policy chain:
 *   per-dashboard override → deployment default (`GLOBAL_ASYNC_QUERIES_DEFAULT`)
 *   → the `GLOBAL_ASYNC_QUERIES` feature-flag gate.
 * Async is never requested when the feature flag is off.
 */
export function resolveAsyncMode(override?: AsyncModeOverride): boolean {
  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    return false;
  }
  if (override === 'force_on') {
    return true;
  }
  if (override === 'force_off') {
    return false;
  }
  return Boolean(
    getBootstrapData().common.conf.GLOBAL_ASYNC_QUERIES_DEFAULT ?? true,
  );
}
