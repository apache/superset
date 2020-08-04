import {geoGnomonicRaw as gnomonicRaw} from "d3-geo";
import {cos} from "./math.js";
import twoPoint from "./twoPoint.js";

export function twoPointAzimuthalRaw(d) {
  var cosd = cos(d);

  function forward(lambda, phi) {
    var coordinates = gnomonicRaw(lambda, phi);
    coordinates[0] *= cosd;
    return coordinates;
  }

  forward.invert = function(x, y) {
    return gnomonicRaw.invert(x / cosd, y);
  };

  return forward;
}

export function twoPointAzimuthalUsa() {
  return twoPointAzimuthal([-158, 21.5], [-77, 39])
      .clipAngle(60)
      .scale(400);
}

export default function twoPointAzimuthal(p0, p1) {
  return twoPoint(twoPointAzimuthalRaw, p0, p1);
}
