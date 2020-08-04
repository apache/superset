"use strict";

exports.__esModule = true;
exports.getLayer = getLayer;
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _deck = require("deck.gl");

var _AnimatableDeckGLContainer = _interopRequireDefault(require("../../AnimatableDeckGLContainer"));

var _Legend = _interopRequireDefault(require("../../components/Legend"));

var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));

var _utils = require("../../utils");

var _common = require("../common");

var _time = require("../../utils/time");

var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));

var _getPointsFromPolygon = _interopRequireDefault(require("../../utils/getPointsFromPolygon"));

var _fitViewport = _interopRequireDefault(require("../../utils/fitViewport"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const DOUBLE_CLICK_TRESHOLD = 250; // milliseconds

function _getElevation(d, colorScaler) {
  /* in deck.gl 5.3.4 (used in Superset as of 2018-10-24), if a polygon has
   * opacity zero it will make everything behind it have opacity zero,
   * effectively showing the map layer no matter what other polygons are
   * behind it.
   */
  return colorScaler(d)[3] === 0 ? 0 : d.elevation;
}

function setTooltipContent(formData) {
  return o => {
    const metricLabel = formData.metric.label || formData.metric;
    return _react.default.createElement("div", {
      className: "deckgl-tooltip"
    }, o.object.name && _react.default.createElement(_TooltipRow.default, {
      label: "name: ",
      value: "" + o.object.name
    }), o.object[formData.line_column] && _react.default.createElement(_TooltipRow.default, {
      label: formData.line_column + ": ",
      value: "" + o.object[formData.line_column]
    }), formData.metric && _react.default.createElement(_TooltipRow.default, {
      label: metricLabel + ": ",
      value: "" + o.object[metricLabel]
    }));
  };
}

function getLayer(formData, payload, onAddFilter, setTooltip, selected, onSelect, filters) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  let data = [...payload.data.features];

  if (filters != null) {
    filters.forEach(f => {
      data = data.filter(x => f(x));
    });
  }

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;

  const accessor = d => d[metricLabel]; // base color for the polygons


  const baseColorScaler = fd.metric === null ? () => [fc.r, fc.g, fc.b, 255 * fc.a] : (0, _utils.getBreakPointColorScaler)(fd, data, accessor); // when polygons are selected, reduce the opacity of non-selected polygons

  const colorScaler = d => {
    const baseColor = baseColorScaler(d);

    if (selected.length > 0 && !selected.includes(d[fd.line_column])) {
      baseColor[3] /= 2;
    }

    return baseColor;
  };

  const tooltipContentGenerator = fd.line_column && fd.metric && ['json', 'geohash', 'zipcode'].includes(fd.line_type) ? setTooltipContent(fd) : undefined;
  return new _deck.PolygonLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    data,
    pickable: true,
    filled: fd.filled,
    stroked: fd.stroked,
    getPolygon: _getPointsFromPolygon.default,
    getFillColor: colorScaler,
    getLineColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    getElevation: d => _getElevation(d, colorScaler),
    elevationScale: fd.multiplier,
    fp64: true
  }, (0, _common.commonLayerProps)(fd, setTooltip, tooltipContentGenerator, onSelect)));
}

const propTypes = {
  formData: _propTypes.default.object.isRequired,
  payload: _propTypes.default.object.isRequired,
  setControlValue: _propTypes.default.func.isRequired,
  viewport: _propTypes.default.object.isRequired,
  onAddFilter: _propTypes.default.func,
  width: _propTypes.default.number.isRequired,
  height: _propTypes.default.number.isRequired
};
const defaultProps = {
  onAddFilter() {}

};

class DeckGLPolygon extends _react.default.Component {
  constructor(props) {
    super(props);

    _defineProperty(this, "containerRef", _react.default.createRef());

    _defineProperty(this, "setTooltip", tooltip => {
      const {
        current
      } = this.containerRef;

      if (current) {
        current.setTooltip(tooltip);
      }
    });

    this.state = DeckGLPolygon.getDerivedStateFromProps(props);
    this.getLayers = this.getLayers.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onValuesChange = this.onValuesChange.bind(this);
  }

  static getDerivedStateFromProps(props, state) {
    const {
      width,
      height,
      formData,
      payload
    } = props; // the state is computed only from the payload; if it hasn't changed, do
    // not recompute state since this would reset selections and/or the play
    // slider position due to changes in form controls

    if (state && payload.form_data === state.formData) {
      return null;
    }

    const features = payload.data.features || [];
    const timestamps = features.map(f => f.__timestamp); // the granularity has to be read from the payload form_data, not the
    // props formData which comes from the instantaneous controls state

    const granularity = payload.form_data.time_grain_sqla || payload.form_data.granularity || 'P1D';
    const {
      start,
      end,
      getStep,
      values,
      disabled
    } = (0, _time.getPlaySliderParams)(timestamps, granularity);
    let {
      viewport
    } = props;

    if (formData.autozoom) {
      viewport = (0, _fitViewport.default)(viewport, {
        width,
        height,
        points: features.flatMap(_getPointsFromPolygon.default)
      });
    }

    return {
      start,
      end,
      getStep,
      values,
      disabled,
      viewport,
      selected: [],
      lastClick: 0,
      formData: payload.form_data
    };
  }

  onSelect(polygon) {
    const {
      formData,
      onAddFilter
    } = this.props;
    const now = new Date();
    const doubleClick = now - this.state.lastClick <= DOUBLE_CLICK_TRESHOLD; // toggle selected polygons

    const selected = [...this.state.selected];

    if (doubleClick) {
      selected.splice(0, selected.length, polygon);
    } else if (formData.toggle_polygons) {
      const i = selected.indexOf(polygon);

      if (i === -1) {
        selected.push(polygon);
      } else {
        selected.splice(i, 1);
      }
    } else {
      selected.splice(0, 1, polygon);
    }

    this.setState({
      selected,
      lastClick: now
    });

    if (formData.table_filter) {
      onAddFilter(formData.line_column, selected, false, true);
    }
  }

  onValuesChange(values) {
    this.setState({
      values: Array.isArray(values) ? values : [values, values + this.state.getStep(values)]
    });
  }

  getLayers(values) {
    if (this.props.payload.data.features === undefined) {
      return [];
    }

    const filters = []; // time filter

    if (values[0] === values[1] || values[1] === this.end) {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    const layer = getLayer(this.props.formData, this.props.payload, this.props.onAddFilter, this.setTooltip, this.state.selected, this.onSelect, filters);
    return [layer];
  }

  render() {
    const {
      payload,
      formData,
      setControlValue
    } = this.props;
    const {
      start,
      end,
      getStep,
      values,
      disabled,
      viewport
    } = this.state;
    const fd = formData;
    const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;

    const accessor = d => d[metricLabel];

    const buckets = (0, _utils.getBuckets)(formData, payload.data.features, accessor);
    return _react.default.createElement("div", {
      style: {
        position: 'relative'
      }
    }, _react.default.createElement(_AnimatableDeckGLContainer.default, {
      ref: this.containerRef,
      aggregation: true,
      getLayers: this.getLayers,
      start: start,
      end: end,
      getStep: getStep,
      values: values,
      disabled: disabled,
      viewport: viewport,
      width: this.props.width,
      height: this.props.height,
      mapboxApiAccessToken: payload.data.mapboxApiKey,
      mapStyle: formData.mapbox_style,
      setControlValue: setControlValue,
      onValuesChange: this.onValuesChange,
      onViewportChange: this.onViewportChange
    }, formData.metric !== null && _react.default.createElement(_Legend.default, {
      categories: buckets,
      position: formData.legend_position,
      format: formData.legend_format
    })));
  }

}

DeckGLPolygon.propTypes = propTypes;
DeckGLPolygon.defaultProps = defaultProps;
var _default = DeckGLPolygon;
exports.default = _default;