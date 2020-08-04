"use strict";

exports.__esModule = true;
exports.default = fitViewport;

var _webMercator = require("@math.gl/web-mercator");

var _computeBoundsFromPoints = _interopRequireDefault(require("./computeBoundsFromPoints"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function fitViewport(originalViewPort, _ref) {
  let {
    points,
    width,
    height,
    minExtent,
    maxZoom,
    offset,
    padding = 20
  } = _ref;
  const {
    bearing,
    pitch
  } = originalViewPort;
  const bounds = (0, _computeBoundsFromPoints.default)(points);

  try {
    return _extends({}, (0, _webMercator.fitBounds)({
      bounds,
      width,
      height,
      minExtent,
      maxZoom,
      offset,
      padding
    }), {
      bearing,
      pitch
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not fit viewport', error);
  }

  return originalViewPort;
}