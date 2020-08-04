import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {degrees, radians} from "./math.js";

export default function(projectAt) {
  var phi0 = 0,
      m = projectionMutator(projectAt),
      p = m(phi0);

  p.parallel = function(_) {
    return arguments.length ? m(phi0 = _ * radians) : phi0 * degrees;
  };

  return p;
}
