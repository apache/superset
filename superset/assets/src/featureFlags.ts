// We can codegen the enum definition based on a list of supported flags that we
// check into source control. We're hardcoding the supported flags for now.
export enum FeatureFlag {
  SCOPED_FILTER = 'SCOPED_FILTER',
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
