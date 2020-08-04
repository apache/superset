import {getScale} from '../scales';
import {bandSpace} from 'vega-scale';
import {isArray} from 'vega-util';

export function bandspace(count, paddingInner, paddingOuter) {
  return bandSpace(count || 0, paddingInner || 0, paddingOuter || 0);
}

export function bandwidth(name, group) {
  const s = getScale(name, (group || this).context);
  return s && s.bandwidth ? s.bandwidth() : 0;
}

export function copy(name, group) {
  const s = getScale(name, (group || this).context);
  return s ? s.copy() : undefined;
}

export function domain(name, group) {
  const s = getScale(name, (group || this).context);
  return s ? s.domain() : [];
}

export function invert(name, range, group) {
  const s = getScale(name, (group || this).context);
  return !s ? undefined
    : isArray(range) ? (s.invertRange || s.invert)(range)
    : (s.invert || s.invertExtent)(range);
}

export function range(name, group) {
  const s = getScale(name, (group || this).context);
  return s && s.range ? s.range() : [];
}

export function scale(name, value, group) {
  const s = getScale(name, (group || this).context);
  return s ? s(value) : undefined;
}
