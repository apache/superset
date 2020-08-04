"use strict";

exports.__esModule = true;
exports.kmToPixels = kmToPixels;
exports.MILES_PER_KM = exports.EARTH_CIRCUMFERENCE_KM = void 0;

var _roundDecimal = _interopRequireDefault(require("./roundDecimal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const EARTH_CIRCUMFERENCE_KM = 40075.16;
exports.EARTH_CIRCUMFERENCE_KM = EARTH_CIRCUMFERENCE_KM;
const MILES_PER_KM = 1.60934;
exports.MILES_PER_KM = MILES_PER_KM;

function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180); // Seems like the zoomLevel is off by one

  const kmPerPixel = EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad) / 2 ** (zoomLevel + 9);
  return (0, _roundDecimal.default)(kilometers / kmPerPixel, 2);
}