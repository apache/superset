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

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';

const originalFeatureFlags = window.featureFlags;
// eslint-disable-next-line no-console
const originalConsoleError = console.error;
const reset = () => {
  window.featureFlags = originalFeatureFlags;
  // eslint-disable-next-line no-console
  console.error = originalConsoleError;
};

it('returns false and raises console error if feature flags have not been initialized', () => {
  // eslint-disable-next-line no-console
  console.error = jest.fn();
  delete (window as any).featureFlags;
  expect(isFeatureEnabled(FeatureFlag.ALLOW_DASHBOARD_DOMAIN_SHARDING)).toEqual(
    false,
  );

  // eslint-disable-next-line no-console
  expect(console.error).toHaveBeenNthCalledWith(
    1,
    'Failed to query feature flag ALLOW_DASHBOARD_DOMAIN_SHARDING (see error below)',
  );

  reset();
});

it('returns false for unset feature flag', () => {
  expect(isFeatureEnabled(FeatureFlag.ALLOW_DASHBOARD_DOMAIN_SHARDING)).toEqual(
    false,
  );

  reset();
});

it('returns true for set feature flag', () => {
  window.featureFlags = {
    [FeatureFlag.CLIENT_CACHE]: true,
  };

  expect(isFeatureEnabled(FeatureFlag.CLIENT_CACHE)).toEqual(true);
  reset();
});
