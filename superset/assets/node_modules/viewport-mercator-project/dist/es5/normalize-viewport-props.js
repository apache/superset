"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = normalizeViewportProps;

var _webMercatorViewport = _interopRequireDefault(require("./web-mercator-viewport"));

var _mathUtils = require("./math-utils");

var MAX_LATITUDE = 85.05113;
var MIN_LATITUDE = -85.05113;

function normalizeViewportProps(_ref) {
  var width = _ref.width,
      height = _ref.height,
      longitude = _ref.longitude,
      latitude = _ref.latitude,
      zoom = _ref.zoom,
      _ref$pitch = _ref.pitch,
      pitch = _ref$pitch === void 0 ? 0 : _ref$pitch,
      _ref$bearing = _ref.bearing,
      bearing = _ref$bearing === void 0 ? 0 : _ref$bearing;

  if (longitude < -180 || longitude > 180) {
    longitude = (0, _mathUtils.mod)(longitude + 180, 360) - 180;
  }

  if (bearing < -180 || bearing > 180) {
    bearing = (0, _mathUtils.mod)(bearing + 180, 360) - 180;
  }

  var flatViewport = new _webMercatorViewport.default({
    width: width,
    height: height,
    longitude: longitude,
    latitude: latitude,
    zoom: zoom
  });
  var topY = flatViewport.project([longitude, MAX_LATITUDE])[1];
  var bottomY = flatViewport.project([longitude, MIN_LATITUDE])[1];
  var shiftY = 0;

  if (bottomY - topY < height) {
    zoom += Math.log2(height / (bottomY - topY));
    flatViewport = new _webMercatorViewport.default({
      width: width,
      height: height,
      longitude: longitude,
      latitude: latitude,
      zoom: zoom
    });
    topY = flatViewport.project([longitude, MAX_LATITUDE])[1];
    bottomY = flatViewport.project([longitude, MIN_LATITUDE])[1];
  }

  if (topY > 0) {
    shiftY = topY;
  } else if (bottomY < height) {
    shiftY = bottomY - height;
  }

  if (shiftY) {
    latitude = flatViewport.unproject([width / 2, height / 2 + shiftY])[1];
  }

  return {
    width: width,
    height: height,
    longitude: longitude,
    latitude: latitude,
    zoom: zoom,
    pitch: pitch,
    bearing: bearing
  };
}
//# sourceMappingURL=normalize-viewport-props.js.map