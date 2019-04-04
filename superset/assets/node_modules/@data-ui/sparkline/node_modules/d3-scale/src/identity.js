import {map} from "./array";
import {linearish} from "./linear";
import number from "./number";

export default function identity() {
  var domain = [0, 1];

  function scale(x) {
    return +x;
  }

  scale.invert = scale;

  scale.domain = scale.range = function(_) {
    return arguments.length ? (domain = map.call(_, number), scale) : domain.slice();
  };

  scale.copy = function() {
    return identity().domain(domain);
  };

  return linearish(scale);
}
