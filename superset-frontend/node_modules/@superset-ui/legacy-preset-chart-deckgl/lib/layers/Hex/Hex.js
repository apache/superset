"use strict";

exports.__esModule = true;
exports.getLayer = getLayer;
exports.default = void 0;

var _deck = require("deck.gl");

var _react = _interopRequireDefault(require("react"));

var _translation = require("@superset-ui/translation");

var _common = require("../common");

var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));

var _factory = require("../../factory");

var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function setTooltipContent(o) {
  return _react.default.createElement("div", {
    className: "deckgl-tooltip"
  }, _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('Centroid (Longitude and Latitude)') + ": ",
    value: "(" + o.coordinate[0] + ", " + o.coordinate[1] + ")"
  }), _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('Height') + ": ",
    value: "" + o.object.elevationValue
  }));
}

function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map(d => _extends({}, d, {
    color: [c.r, c.g, c.b, 255 * c.a]
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const aggFunc = (0, _common.getAggFunc)(fd.js_agg_function, p => p.weight);
  return new _deck.HexagonLayer(_extends({
    id: "hex-layer-" + fd.slice_id,
    data,
    pickable: true,
    radius: fd.grid_size,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: aggFunc,
    getColorValue: aggFunc
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}

function getPoints(data) {
  return data.map(d => d.position);
}

var _default = (0, _factory.createDeckGLComponent)(getLayer, getPoints);

exports.default = _default;