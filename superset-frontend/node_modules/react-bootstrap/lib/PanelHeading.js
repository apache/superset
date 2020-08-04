"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _classnames = _interopRequireDefault(require("classnames"));

var _elementType = _interopRequireDefault(require("react-prop-types/lib/elementType"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  componentClass: _elementType.default
};
var defaultProps = {
  componentClass: 'div'
};
var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    headingId: _propTypes.default.string,
    bsClass: _propTypes.default.string
  })
};

var PanelHeading =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelHeading, _React$Component);

  function PanelHeading() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelHeading.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className,
        Component = _this$props.componentClass,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["children", "className", "componentClass"]);

    var _ref = this.context.$bs_panel || {},
        headingId = _ref.headingId,
        _bsClass = _ref.bsClass;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    if (headingId) {
      elementProps.role = elementProps.role || 'tab';
      elementProps.id = headingId;
    }

    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'heading'))
    }), children);
  };

  return PanelHeading;
}(_react.default.Component);

PanelHeading.propTypes = propTypes;
PanelHeading.defaultProps = defaultProps;
PanelHeading.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('panel', PanelHeading);

exports.default = _default;
module.exports = exports["default"];