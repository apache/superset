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

var _geo = require("../../utils/geo");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function getPoints(data) {
  return data.map(d => d.position);
}

function setTooltipContent(formData) {
  return o => _react.default.createElement("div", {
    className: "deckgl-tooltip"
  }, _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('Longitude and Latitude') + ": ",
    value: o.object.position[0] + ", " + o.object.position[1]
  }), o.object.cat_color && _react.default.createElement(_TooltipRow.default, {
    label: (0, _translation.t)('Category') + ": ",
    value: "" + o.object.cat_color
  }), o.object.metric && _react.default.createElement(_TooltipRow.default, {
    label: formData.point_radius_fixed.value.label + ": ",
    value: "" + o.object.metric
  }));
}

function getLayer(formData, payload, onAddFilter, setTooltip) {
  const fd = formData;
  const dataWithRadius = payload.data.features.map(d => {
    let radius = (0, _geo.unitToRadius)(fd.point_unit, d.radius) || 10;

    if (fd.multiplier) {
      radius *= fd.multiplier;
    }

    if (d.color) {
      return _extends({}, d, {
        radius
      });
    }

    const c = fd.color_picker || {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    };
    const color = [c.r, c.g, c.b, c.a * 255];
    return _extends({}, d, {
      radius,
      color
    });
  });
  return new _deck.ScatterplotLayer(_extends({
    id: "scatter-layer-" + fd.slice_id,
    data: dataWithRadius,
    fp64: true,
    getFillColor: d => d.color,
    getRadius: d => d.radius,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    stroked: false
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent(fd))));
}

var _default = (0, _factory.createCategoricalDeckGLComponent)(getLayer, getPoints);

exports.default = _default;