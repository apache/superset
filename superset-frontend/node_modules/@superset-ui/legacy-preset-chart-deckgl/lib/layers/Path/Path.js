"use strict";

exports.__esModule = true;
exports.getLayer = getLayer;
exports.default = void 0;

var _deck = require("deck.gl");

var _react = _interopRequireDefault(require("react"));

var _common = require("../common");

var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));

var _factory = require("../../factory");

var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function setTooltipContent(o) {
  return o.object.extraProps && _react.default.createElement("div", {
    className: "deckgl-tooltip"
  }, Object.keys(o.object.extraProps).map((prop, index) => _react.default.createElement(_TooltipRow.default, {
    key: "prop-" + index,
    label: prop + ": ",
    value: "" + o.object.extraProps[prop]
  })));
}

function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map(feature => _extends({}, feature, {
    path: feature.path,
    width: fd.line_width,
    color: fixedColor
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new _deck.PathLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    getColor: d => d.color,
    getPath: d => d.path,
    getWidth: d => d.width,
    data,
    rounded: true,
    widthScale: 1
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}

function getPoints(data) {
  let points = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });
  return points;
}

var _default = (0, _factory.createDeckGLComponent)(getLayer, getPoints);

exports.default = _default;