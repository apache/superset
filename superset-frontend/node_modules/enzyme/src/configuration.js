import validateAdapter from './validateAdapter';

let configuration = {};

export function get() {
  return { ...configuration };
}

export function merge(extra) {
  if (extra.adapter) {
    validateAdapter(extra.adapter);
  }
  Object.assign(configuration, extra);
}

export function reset(replacementConfig = {}) {
  configuration = {};
  merge(replacementConfig);
}
