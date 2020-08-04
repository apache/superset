import {scale as getScale} from './scales';
import {constant, peek} from 'vega-util';
import * as $ from 'd3-interpolate';

const scaleProps = ['clamp', 'base', 'constant', 'exponent'];

export function interpolateRange(interpolator, range) {
  var start = range[0],
      span = peek(range) - start;
  return function(i) { return interpolator(start + i * span); };
}

export function interpolateColors(colors, type, gamma) {
  return $.piecewise(interpolate(type || 'rgb', gamma), colors);
}

export function quantizeInterpolator(interpolator, count) {
  var samples = new Array(count),
      n = count + 1;
  for (var i = 0; i < count;) samples[i] = interpolator(++i / n);
  return samples;
}

export function scaleCopy(scale) {
  const t = scale.type,
        s = scale.copy();
  s.type = t;
  return s;
}

export function scaleFraction(scale, min, max) {
  var delta = max - min, i, t, s;

  if (!delta || !Number.isFinite(delta)) {
    return constant(0.5);
  } else {
    i = (t = scale.type).indexOf('-');
    t = i < 0 ? t : t.slice(i + 1);
    s = getScale(t)().domain([min, max]).range([0, 1]);
    scaleProps.forEach(m => scale[m] ? s[m](scale[m]()) : 0);
    return s;
  }
}

export function interpolate(type, gamma) {
  var interp = $[method(type)];
  return (gamma != null && interp && interp.gamma)
    ? interp.gamma(gamma)
    : interp;
}

function method(type) {
  return 'interpolate' + type.toLowerCase()
    .split('-')
    .map(function(s) { return s[0].toUpperCase() + s.slice(1); })
    .join('');
}
