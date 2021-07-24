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
import { Behavior, FeatureFlag } from '@superset-ui/core';
import * as featureFlags from 'src/featureFlags';
import { nativeFilterGate } from './utils';

let isFeatureEnabledMock: jest.MockInstance<boolean, [feature: FeatureFlag]>;

describe('nativeFilterGate', () => {
  describe('with all feature flags disabled', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => false);
    });

    afterAll(() => {
      // @ts-ignore
      isFeatureEnabledMock.restore();
    });

    it('should return true for regular chart', () => {
      expect(nativeFilterGate([])).toEqual(true);
    });

    it('should return true for cross filter chart', () => {
      expect(nativeFilterGate([Behavior.INTERACTIVE_CHART])).toEqual(true);
    });

    it('should return false for native filter chart with cross filter support', () => {
      expect(
        nativeFilterGate([Behavior.NATIVE_FILTER, Behavior.INTERACTIVE_CHART]),
      ).toEqual(false);
    });

    it('should return false for native filter behavior', () => {
      expect(nativeFilterGate([Behavior.NATIVE_FILTER])).toEqual(false);
    });
  });

  describe('with only native filters feature flag enabled', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(
          (featureFlag: FeatureFlag) =>
            featureFlag === FeatureFlag.DASHBOARD_NATIVE_FILTERS,
        );
    });

    afterAll(() => {
      // @ts-ignore
      isFeatureEnabledMock.restore();
    });

    it('should return true for regular chart', () => {
      expect(nativeFilterGate([])).toEqual(true);
    });

    it('should return true for cross filter chart', () => {
      expect(nativeFilterGate([Behavior.INTERACTIVE_CHART])).toEqual(true);
    });

    it('should return false for native filter chart with cross filter support', () => {
      expect(
        nativeFilterGate([Behavior.NATIVE_FILTER, Behavior.INTERACTIVE_CHART]),
      ).toEqual(false);
    });

    it('should return false for native filter behavior', () => {
      expect(nativeFilterGate([Behavior.NATIVE_FILTER])).toEqual(false);
    });
  });

  describe('with native filters and experimental feature flag enabled', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation((featureFlag: FeatureFlag) =>
          [
            FeatureFlag.DASHBOARD_CROSS_FILTERS,
            FeatureFlag.DASHBOARD_FILTERS_EXPERIMENTAL,
          ].includes(featureFlag),
        );
    });

    afterAll(() => {
      // @ts-ignore
      isFeatureEnabledMock.restore();
    });

    it('should return true for regular chart', () => {
      expect(nativeFilterGate([])).toEqual(true);
    });

    it('should return true for cross filter chart', () => {
      expect(nativeFilterGate([Behavior.INTERACTIVE_CHART])).toEqual(true);
    });

    it('should return true for native filter chart with cross filter support', () => {
      expect(
        nativeFilterGate([Behavior.NATIVE_FILTER, Behavior.INTERACTIVE_CHART]),
      ).toEqual(true);
    });

    it('should return false for native filter behavior', () => {
      expect(nativeFilterGate([Behavior.NATIVE_FILTER])).toEqual(false);
    });
  });
});
