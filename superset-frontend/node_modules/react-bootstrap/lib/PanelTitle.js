"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _elementType = _interopRequireDefault(require("react-prop-types/lib/elementType"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _PanelToggle = _interopRequireDefault(require("./PanelToggle"));

var propTypes = {
  componentClass: _elementType.default,

  /**
   * A convenience prop that renders the Panel.Title as a panel collapse toggle component
   * for the common use-case.
   */
  toggle: _propTypes.default.bool
};
var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    bsClass: _propTypes.default.string
  })
};
var defaultProps = {
  componentClass: 'div'
};

var PanelTitle =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelTitle, _React$Component);

  function PanelTitle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelTitle.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className,
        toggle = _this$props.toggle,
        Component = _this$props.componentClass,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["children", "className", "toggle", "componentClass"]);

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    if (toggle) {
      children = _react.default.createElement(_PanelToggle.default, null, children);
    }

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'title'))
    }), children);
  };

  return PanelTitle;
}(_react.default.Component);

PanelTitle.propTypes = propTypes;
PanelTitle.defaultProps = defaultProps;
PanelTitle.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('panel', PanelTitle);

exports.default = _default;
module.exports = exports["default"];