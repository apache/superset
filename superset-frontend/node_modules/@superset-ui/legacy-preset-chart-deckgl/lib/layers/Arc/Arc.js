"use strict";

exports.__esModule = true;
exports.getLayer = getLayer;
exports.default = void 0;

var _deck = require("deck.gl");

var _react = _interopRequireDefault(require("react"));

var _translation = require("@superset-ui/translation");

var _common = require("../common");

var _factory = require("../../factory");

var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function getPoints(data) {
  const points = [];
  data.forEach(d => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

function setTooltipContent(formData) {
  return o => _react.default.createElement("div", {
    className: "deckgl-tooltip"
  }, _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('Start (Longitude, Latitude)') + ": ",
    value: o.object.sourcePosition[0] + ", " + o.object.sourcePosition[1]
  }), _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('End (Longitude, Latitude)') + ": ",
    value: o.object.targetPosition[0] + ", " + o.object.targetPosition[1]
  }), formData.dimension && _react.default.createElement(_TooltipRow.default, {
    label: formData.dimension + ": ",
    value: "" + o.object.cat_color
  }));
}

function getLayer(fd, payload, onAddFilter, setTooltip) {
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;
  return new _deck.ArcLayer(_extends({
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    id: "path-layer-" + fd.slice_id,
    strokeWidth: fd.stroke_width ? fd.stroke_width : 3
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent(fd))));
}

var _default = (0, _factory.createCategoricalDeckGLComponent)(getLayer, getPoints);

exports.default = _default;