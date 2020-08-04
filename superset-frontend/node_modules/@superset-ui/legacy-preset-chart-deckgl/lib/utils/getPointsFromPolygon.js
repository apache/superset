"use strict";

exports.__esModule = true;
exports.default = getPointsFromPolygon;

/** Format originally used by the Polygon plugin */

/**
 * Format that is geojson standard
 * https://geojson.org/geojson-spec.html
 */
function getPointsFromPolygon(feature) {
  return 'geometry' in feature.polygon ? feature.polygon.geometry.coordinates[0] : feature.polygon;
}