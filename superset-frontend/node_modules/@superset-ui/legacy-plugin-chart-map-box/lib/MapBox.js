"use strict";

exports.__esModule = true;
exports.default = exports.DEFAULT_POINT_RADIUS = exports.DEFAULT_MAX_ZOOM = void 0;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _reactMapGl = _interopRequireDefault(require("react-map-gl"));

var _immutable = _interopRequireDefault(require("immutable"));

var _viewportMercatorProject = _interopRequireDefault(require("viewport-mercator-project"));

var _ScatterPlotGlowOverlay = _interopRequireDefault(require("./ScatterPlotGlowOverlay"));

require("./MapBox.css");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const NOOP = () => {};

const DEFAULT_MAX_ZOOM = 16;
exports.DEFAULT_MAX_ZOOM = DEFAULT_MAX_ZOOM;
const DEFAULT_POINT_RADIUS = 60;
exports.DEFAULT_POINT_RADIUS = DEFAULT_POINT_RADIUS;
const propTypes = {
  width: _propTypes.default.number,
  height: _propTypes.default.number,
  aggregatorName: _propTypes.default.string,
  clusterer: _propTypes.default.object,
  globalOpacity: _propTypes.default.number,
  hasCustomMetric: _propTypes.default.bool,
  mapStyle: _propTypes.default.string,
  mapboxApiKey: _propTypes.default.string.isRequired,
  onViewportChange: _propTypes.default.func,
  pointRadius: _propTypes.default.number,
  pointRadiusUnit: _propTypes.default.string,
  renderWhileDragging: _propTypes.default.bool,
  rgb: _propTypes.default.array,
  bounds: _propTypes.default.array
};
const defaultProps = {
  width: 400,
  height: 400,
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels'
};

class MapBox extends _react.default.Component {
  constructor(props) {
    super(props);
    const {
      width,
      height,
      bounds
    } = this.props; // Get a viewport that fits the given bounds, which all marks to be clustered.
    // Derive lat, lon and zoom from this viewport. This is only done on initial
    // render as the bounds don't update as we pan/zoom in the current design.

    const mercator = new _viewportMercatorProject.default({
      width,
      height
    }).fitBounds(bounds);
    const {
      latitude,
      longitude,
      zoom
    } = mercator;
    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom
      }
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  handleViewportChange(viewport) {
    this.setState({
      viewport
    });
    const {
      onViewportChange
    } = this.props;
    onViewportChange(viewport);
  }

  render() {
    const {
      width,
      height,
      aggregatorName,
      clusterer,
      globalOpacity,
      mapStyle,
      mapboxApiKey,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      hasCustomMetric,
      bounds
    } = this.props;
    const {
      viewport
    } = this.state;
    const isDragging = viewport.isDragging === undefined ? false : viewport.isDragging; // Compute the clusters based on the original bounds and current zoom level. Note when zoom/pan
    // to an area outside of the original bounds, no additional queries are made to the backend to
    // retrieve additional data.

    const bbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
    const clusters = clusterer.getClusters(bbox, Math.round(viewport.zoom));
    return /*#__PURE__*/_react.default.createElement(_reactMapGl.default, _extends({}, viewport, {
      mapStyle: mapStyle,
      width: width,
      height: height,
      mapboxApiAccessToken: mapboxApiKey,
      onViewportChange: this.handleViewportChange
    }), /*#__PURE__*/_react.default.createElement(_ScatterPlotGlowOverlay.default, _extends({}, viewport, {
      isDragging: isDragging,
      locations: _immutable.default.fromJS(clusters),
      dotRadius: pointRadius,
      pointRadiusUnit: pointRadiusUnit,
      rgb: rgb,
      globalOpacity: globalOpacity,
      compositeOperation: "screen",
      renderWhileDragging: renderWhileDragging,
      aggregation: hasCustomMetric ? aggregatorName : null,
      lngLatAccessor: location => {
        const coordinates = location.get('geometry').get('coordinates');
        return [coordinates.get(0), coordinates.get(1)];
      }
    })));
  }

}

MapBox.propTypes = propTypes;
MapBox.defaultProps = defaultProps;
var _default = MapBox;
exports.default = _default;