import { isFunction } from 'underscore';

export function functor(v) {
  return isFunction(v) ? v : () => v;
}
