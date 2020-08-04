"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  /**
   * Turn any fixed-width grid layout into a full-width layout by this property.
   *
   * Adds `container-fluid` class.
   */
  fluid: _propTypes.default.bool,

  /**
   * You can use a custom element for this component
   */
  componentClass: _elementType.default
};
var defaultProps = {
  componentClass: 'div',
  fluid: false
};

var Grid =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Grid, _React$Component);

  function Grid() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Grid.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        fluid = _this$props.fluid,
        Component = _this$props.componentClass,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["fluid", "componentClass", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.prefix)(bsProps, fluid && 'fluid');
    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Grid;
}(_react.default.Component);

Grid.propTypes = propTypes;
Grid.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('container', Grid);

exports.default = _default;
module.exports = exports["default"];