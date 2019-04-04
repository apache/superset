import validateAdapter from './validateAdapter';
import { get } from './configuration';

export default function getAdapter(options = {}) {
  if (options.adapter) {
    validateAdapter(options.adapter);
    return options.adapter;
  }
  const { adapter } = get();
  validateAdapter(adapter);
  return adapter;
}
