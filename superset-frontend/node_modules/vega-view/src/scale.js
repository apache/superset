import {error, hasOwnProperty} from 'vega-util';

export function scale(name) {
  var scales = this._runtime.scales;
  if (!hasOwnProperty(scales, name)) {
    error('Unrecognized scale or projection: ' + name);
  }
  return scales[name].value;
}
