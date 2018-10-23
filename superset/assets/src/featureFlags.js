// A higher-order function that takes the redux state tree and returns a
// `isFeatureEnabled` function which takes a feature and returns whether it is enabled.
// Note that we assume the featureFlags subtree is at the root of the redux state tree.
export function isFeatureEnabledCreator(state) {
  return feature => !!state.featureFlags[feature];
}

// Feature flags are not altered throughout the life time of the app
export default function featureFlagsReducer(state = {}) {
  return state;
}
