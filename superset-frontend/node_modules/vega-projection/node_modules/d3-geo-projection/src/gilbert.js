import {geoEquirectangular, geoOrthographic} from "d3-geo";
import {asin, atan, degrees, radians, sin, tan} from "./math.js";

function gilbertForward(point) {
  return [point[0] / 2, asin(tan(point[1] / 2 * radians)) * degrees];
}

function gilbertInvert(point) {
  return [point[0] * 2, 2 * atan(sin(point[1] * radians)) * degrees];
}

export default function(projectionType) {
  if (projectionType == null) projectionType = geoOrthographic;
  var projection = projectionType(),
      equirectangular = geoEquirectangular().scale(degrees).precision(0).clipAngle(null).translate([0, 0]); // antimeridian cutting

  function gilbert(point) {
    return projection(gilbertForward(point));
  }

  if (projection.invert) gilbert.invert = function(point) {
    return gilbertInvert(projection.invert(point));
  };

  gilbert.stream = function(stream) {
    var s1 = projection.stream(stream), s0 = equirectangular.stream({
      point: function(lambda, phi) { s1.point(lambda / 2, asin(tan(-phi / 2 * radians)) * degrees); },
      lineStart: function() { s1.lineStart(); },
      lineEnd: function() { s1.lineEnd(); },
      polygonStart: function() { s1.polygonStart(); },
      polygonEnd: function() { s1.polygonEnd(); }
    });
    s0.sphere = s1.sphere;
    return s0;
  };

  function property(name) {
    gilbert[name] = function() {
      return arguments.length ? (projection[name].apply(projection, arguments), gilbert) : projection[name]();
    };
  }

  gilbert.rotate = function(_) {
    return arguments.length ? (equirectangular.rotate(_), gilbert) : equirectangular.rotate();
  };

  gilbert.center = function(_) {
    return arguments.length ? (projection.center(gilbertForward(_)), gilbert) : gilbertInvert(projection.center());
  };

  property("angle");
  property("clipAngle");
  property("clipExtent");
  property("fitExtent");
  property("fitHeight");
  property("fitSize");
  property("fitWidth");
  property("scale");
  property("translate");
  property("precision");

  return gilbert
      .scale(249.5);
}
