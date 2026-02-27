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
import {
  FeatureFlag,
  initFeatureFlags,
  isFeatureEnabled,
} from '@superset-ui/core';
import * as uiCore from '@apache-superset/core';

test('initializes feature flags', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: undefined,
  });
  initFeatureFlags();
  expect(window.featureFlags).toEqual({});
});

test('initializes feature flags with predefined values', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: undefined,
  });
  const featureFlags = {
    DRILL_BY: false,
  };
  initFeatureFlags(featureFlags);
  expect(window.featureFlags).toEqual(featureFlags);
});

test('does nothing if feature flags are already initialized', () => {
  const featureFlags = { DRILL_BY: false };
  Object.defineProperty(window, 'featureFlags', {
    value: featureFlags,
  });
  initFeatureFlags({ DRILL_BY: true });
  expect(window.featureFlags).toEqual(featureFlags);
});

test('returns false and raises console error if feature flags have not been initialized', () => {
  const logging = jest.spyOn(uiCore.logging, 'error');
  Object.defineProperty(window, 'featureFlags', {
    value: undefined,
  });
  expect(isFeatureEnabled(FeatureFlag.DrillBy)).toEqual(false);
  expect(uiCore.logging.error).toHaveBeenCalled();
  expect(logging).toHaveBeenCalledWith('Failed to query feature flag DRILL_BY');
});

test('returns false for unset feature flag', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: {},
  });
  expect(isFeatureEnabled(FeatureFlag.DrillBy)).toEqual(false);
});

test('returns true for set feature flag', () => {
  Object.defineProperty(window, 'featureFlags', {
    value: {
      DRILL_BY: true,
    },
  });
  expect(isFeatureEnabled(FeatureFlag.DrillBy)).toEqual(true);
});
