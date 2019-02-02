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
// We can codegen the enum definition based on a list of supported flags that we
// check into source control. We're hardcoding the supported flags for now.
export enum FeatureFlag {
  SCOPED_FILTER = 'SCOPED_FILTER',
  OMNIBAR = 'OMNIBAR',
}

export type FeatureFlagMap = {
  [key in FeatureFlag]?: boolean;
};

declare global {
  interface Window {
    featureFlags: FeatureFlagMap;
  }
}

export function initFeatureFlags(featureFlags: FeatureFlagMap) {
  window.featureFlags = featureFlags || {};
}

export function isFeatureEnabled(feature: FeatureFlag) {
  return !!window.featureFlags[feature];
}
