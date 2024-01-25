// DODO was here
import { FeatureFlagMap, FeatureFlag } from '@superset-ui/core';

export { FeatureFlagMap, FeatureFlag } from '@superset-ui/core';

export function initFeatureFlags(featureFlags: FeatureFlagMap) {
  if (!window.featureFlags && featureFlags !== undefined) {
    window.featureFlags = featureFlags || {};
  }
}

export function isFeatureEnabled(feature: FeatureFlag) {
  // DODO changed
  return window?.featureFlags && !!window.featureFlags[feature];
}
