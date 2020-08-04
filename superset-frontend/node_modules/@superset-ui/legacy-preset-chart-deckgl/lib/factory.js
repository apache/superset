"use strict";

exports.__esModule = true;
exports.createDeckGLComponent = createDeckGLComponent;
exports.createCategoricalDeckGLComponent = createCategoricalDeckGLComponent;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _lodash = require("lodash");

var _DeckGLContainer = _interopRequireDefault(require("./DeckGLContainer"));

var _CategoricalDeckGLContainer = _interopRequireDefault(require("./CategoricalDeckGLContainer"));

var _fitViewport = _interopRequireDefault(require("./utils/fitViewport"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

function createDeckGLComponent(getLayer, getPoints) {
  // Higher order component
  class Component extends _react.default.PureComponent {
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

      const {
        width,
        height,
        formData
      } = props;
      let {
        viewport
      } = props;

      if (formData.autozoom) {
        viewport = (0, _fitViewport.default)(viewport, {
          width,
          height,
          points: getPoints(props.payload.data.features)
        });
      }

      this.state = {
        viewport,
        layer: this.computeLayer(props)
      };
      this.onViewportChange = this.onViewportChange.bind(this);
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
      // Only recompute the layer if anything BUT the viewport has changed
      const nextFdNoVP = _extends({}, nextProps.formData, {
        viewport: null
      });

      const currFdNoVP = _extends({}, this.props.formData, {
        viewport: null
      });

      if (!(0, _lodash.isEqual)(nextFdNoVP, currFdNoVP) || nextProps.payload !== this.props.payload) {
        this.setState({
          layer: this.computeLayer(nextProps)
        });
      }
    }

    onViewportChange(viewport) {
      this.setState({
        viewport
      });
    }

    computeLayer(props) {
      const {
        formData,
        payload,
        onAddFilter
      } = props;
      return getLayer(formData, payload, onAddFilter, this.setTooltip);
    }

    render() {
      const {
        formData,
        payload,
        setControlValue,
        height,
        width
      } = this.props;
      const {
        layer,
        viewport
      } = this.state;
      return _react.default.createElement(_DeckGLContainer.default, {
        ref: this.containerRef,
        mapboxApiAccessToken: payload.data.mapboxApiKey,
        viewport: viewport,
        layers: [layer],
        mapStyle: formData.mapbox_style,
        setControlValue: setControlValue,
        width: width,
        height: height,
        onViewportChange: this.onViewportChange
      });
    }

  }

  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;
  return Component;
}

function createCategoricalDeckGLComponent(getLayer, getPoints) {
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      viewport,
      width,
      height
    } = props;
    return _react.default.createElement(_CategoricalDeckGLContainer.default, {
      formData: formData,
      mapboxApiKey: payload.data.mapboxApiKey,
      setControlValue: setControlValue,
      viewport: viewport,
      getLayer: getLayer,
      payload: payload,
      getPoints: getPoints,
      width: width,
      height: height
    });
  }

  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;
  return Component;
}