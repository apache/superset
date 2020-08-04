import {ascending, bisect} from "d3-array";
import {identity} from "./continuous";
import {initInterpolator} from "./init";

export default function sequentialQuantile() {
  var domain = [],
      interpolator = identity;

  function scale(x) {
    if (!isNaN(x = +x)) return interpolator((bisect(domain, x) - 1) / (domain.length - 1));
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain.slice();
    domain = [];
    for (var i = 0, n = _.length, d; i < n; ++i) if (d = _[i], d != null && !isNaN(d = +d)) domain.push(d);
    domain.sort(ascending);
    return scale;
  };

  scale.interpolator = function(_) {
    return arguments.length ? (interpolator = _, scale) : interpolator;
  };

  scale.copy = function() {
    return sequentialQuantile(interpolator).domain(domain);
  };

  return initInterpolator.apply(scale, arguments);
}
