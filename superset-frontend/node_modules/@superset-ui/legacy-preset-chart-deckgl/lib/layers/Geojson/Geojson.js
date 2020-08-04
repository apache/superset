"use strict";

exports.__esModule = true;
exports.getLayer = getLayer;
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _deck = require("deck.gl");

var _DeckGLContainer = _interopRequireDefault(require("../../DeckGLContainer"));

var _colors = require("../../utils/colors");

var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));

var _common = require("../common");

var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth'
};

const alterProps = (props, propOverrides) => {
  const newProps = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });

  if (typeof props.fillColor === 'string') {
    newProps.fillColor = (0, _colors.hexToRGB)(props.fillColor);
  }

  if (typeof props.strokeColor === 'string') {
    newProps.strokeColor = (0, _colors.hexToRGB)(props.strokeColor);
  }

  return _extends({}, newProps, {}, propOverrides);
};

let features;

const recurseGeoJson = (node, propOverrides, extraProps) => {
  if (node && node.features) {
    node.features.forEach(obj => {
      recurseGeoJson(obj, propOverrides, node.extraProps || extraProps);
    });
  }

  if (node && node.geometry) {
    const newNode = _extends({}, node, {
      properties: alterProps(node.properties, propOverrides)
    });

    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }

    features.push(newNode);
  }
};

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
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const propOverrides = {};

  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }

  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }

  features = [];
  recurseGeoJson(payload.data, propOverrides);
  let jsFnMutator;

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    features = jsFnMutator(features);
  }

  return new _deck.GeoJsonLayer(_extends({
    id: "geojson-layer-" + fd.slice_id,
    filled: fd.filled,
    data: features,
    stroked: fd.stroked,
    extruded: fd.extruded,
    pointRadiusScale: fd.point_radius_scale
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}

const propTypes = {
  formData: _propTypes.default.object.isRequired,
  payload: _propTypes.default.object.isRequired,
  setControlValue: _propTypes.default.func.isRequired,
  viewport: _propTypes.default.object.isRequired,
  onAddFilter: _propTypes.default.func
};
const defaultProps = {
  onAddFilter() {}

};

class DeckGLGeoJson extends _react.default.Component {
  constructor() {
    super(...arguments);

    _defineProperty(this, "containerRef", _react.default.createRef());

    _defineProperty(this, "setTooltip", tooltip => {
      const {
        current
      } = this.containerRef;

      if (current) {
        current.setTooltip(tooltip);
      }
    });
  }

  render() {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      viewport
    } = this.props; // TODO get this to work
    // if (formData.autozoom) {
    //   viewport = common.fitViewport(viewport, geojsonExtent(payload.data.features));
    // }

    const layer = getLayer(formData, payload, onAddFilter, this.setTooltip);
    return _react.default.createElement(_DeckGLContainer.default, {
      ref: this.containerRef,
      mapboxApiAccessToken: payload.data.mapboxApiKey,
      viewport: viewport,
      layers: [layer],
      mapStyle: formData.mapbox_style,
      setControlValue: setControlValue
    });
  }

}

DeckGLGeoJson.propTypes = propTypes;
DeckGLGeoJson.defaultProps = defaultProps;
var _default = DeckGLGeoJson;
exports.default = _default;