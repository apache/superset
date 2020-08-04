import {geoProjection as projection} from "d3-geo";
import {aitoffRaw} from "./aitoff.js";
import {halfPi, epsilon, sin, cos, sqrt, abs, acos} from "./math.js";

export function winkel3Raw(lambda, phi) {
  var coordinates = aitoffRaw(lambda, phi);
  return [
    (coordinates[0] + lambda / halfPi) / 2,
    (coordinates[1] + phi) / 2
  ];
}

winkel3Raw.invert = function(x, y) {
  var lambda = x, phi = y, i = 25;
  do {
    var cosphi = cos(phi),
        sinphi = sin(phi),
        sin_2phi = sin(2 * phi),
        sin2phi = sinphi * sinphi,
        cos2phi = cosphi * cosphi,
        sinlambda = sin(lambda),
        coslambda_2 = cos(lambda / 2),
        sinlambda_2 = sin(lambda / 2),
        sin2lambda_2 = sinlambda_2 * sinlambda_2,
        C = 1 - cos2phi * coslambda_2 * coslambda_2,
        E = C ? acos(cosphi * coslambda_2) * sqrt(F = 1 / C) : F = 0,
        F,
        fx = 0.5 * (2 * E * cosphi * sinlambda_2 + lambda / halfPi) - x,
        fy = 0.5 * (E * sinphi + phi) - y,
        dxdlambda = 0.5 * F * (cos2phi * sin2lambda_2 + E * cosphi * coslambda_2 * sin2phi) + 0.5 / halfPi,
        dxdphi = F * (sinlambda * sin_2phi / 4 - E * sinphi * sinlambda_2),
        dydlambda = 0.125 * F * (sin_2phi * sinlambda_2 - E * sinphi * cos2phi * sinlambda),
        dydphi = 0.5 * F * (sin2phi * coslambda_2 + E * sin2lambda_2 * cosphi) + 0.5,
        denominator = dxdphi * dydlambda - dydphi * dxdlambda,
        dlambda = (fy * dxdphi - fx * dydphi) / denominator,
        dphi = (fx * dydlambda - fy * dxdlambda) / denominator;
    lambda -= dlambda, phi -= dphi;
  } while ((abs(dlambda) > epsilon || abs(dphi) > epsilon) && --i > 0);
  return [lambda, phi];
};

export default function() {
  return projection(winkel3Raw)
      .scale(158.837);
}
