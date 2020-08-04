/* global window */
import assert from '../utils/assert';

export default function getPixelRatio(useDevicePixels) {
  assert(typeof useDevicePixels === 'boolean', 'Invalid useDevicePixels');
  return useDevicePixels && typeof window !== 'undefined' ? window.devicePixelRatio : 1;
}
