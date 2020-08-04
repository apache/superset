import {geoAzimuthalEqualAreaRaw as azimuthalEqualAreaRaw, geoProjectionMutator as projectionMutator} from "d3-geo";
import {asin, cos, sin} from "./math.js";

export function hammerRaw(A, B) {
  if (arguments.length < 2) B = A;
  if (B === 1) return azimuthalEqualAreaRaw;
  if (B === Infinity) return hammerQuarticAuthalicRaw;

  function forward(lambda, phi) {
    var coordinates = azimuthalEqualAreaRaw(lambda / B, phi);
    coordinates[0] *= A;
    return coordinates;
  }

  forward.invert = function(x, y) {
    var coordinates = azimuthalEqualAreaRaw.invert(x / A, y);
    coordinates[0] *= B;
    return coordinates;
  };

  return forward;
}

function hammerQuarticAuthalicRaw(lambda, phi) {
  return [
    lambda * cos(phi) / cos(phi /= 2),
    2 * sin(phi)
  ];
}

hammerQuarticAuthalicRaw.invert = function(x, y) {
  var phi = 2 * asin(y / 2);
  return [
    x * cos(phi / 2) / cos(phi),
    phi
  ];
};

export default function() {
  var B = 2,
      m = projectionMutator(hammerRaw),
      p = m(B);

  p.coefficient = function(_) {
    if (!arguments.length) return B;
    return m(B = +_);
  };

  return p
    .scale(169.529);
}
