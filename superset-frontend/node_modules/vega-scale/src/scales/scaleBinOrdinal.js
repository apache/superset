import {bisect} from 'd3-array';
import {tickFormat} from 'd3-scale';
import {peek} from 'vega-util';
import {numbers} from './numbers';
import {slice} from './slice';

export function scaleBinOrdinal() {
  var domain = [],
      range = [];

  function scale(x) {
    return x == null || x !== x
      ? undefined
      : range[(bisect(domain, x) - 1) % range.length];
  }

  scale.domain = function(_) {
    if (arguments.length) {
      domain = numbers(_);
      return scale;
    } else {
      return domain.slice();
    }
  };

  scale.range = function(_) {
    if (arguments.length) {
      range = slice.call(_);
      return scale;
    } else {
      return range.slice();
    }
  };

  scale.tickFormat = function(count, specifier) {
    return tickFormat(domain[0], peek(domain), count == null ? 10 : count, specifier);
  };

  scale.copy = function() {
    return scaleBinOrdinal().domain(scale.domain()).range(scale.range());
  };

  return scale;
}