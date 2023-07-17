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
import mockConsole from 'jest-mock-console';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';

it('returns false and raises console error if feature flags have not been initialized', () => {
  mockConsole();
  Object.defineProperty(window, 'featureFlags', {
    value: undefined,
  });

  expect(isFeatureEnabled(FeatureFlag.DRILL_BY)).toEqual(false);
  expect(console.error).toHaveBeenCalled();
  // @ts-expect-error
  expect(console.error.mock.calls[0][0]).toEqual(
    'Failed to query feature flag DRILL_BY',
  );
});

it('returns false for unset feature flag', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: {},
  });

  expect(isFeatureEnabled(FeatureFlag.DRILL_BY)).toEqual(false);
});

it('returns true for set feature flag', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: {
      CLIENT_CACHE: true,
    },
  });

  expect(isFeatureEnabled(FeatureFlag.CLIENT_CACHE)).toEqual(true);
});
