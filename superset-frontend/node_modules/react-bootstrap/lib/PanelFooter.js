"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _classnames = _interopRequireDefault(require("classnames"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    bsClass: _propTypes.default.string
  })
};

var PanelFooter =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelFooter, _React$Component);

  function PanelFooter() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelFooter.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className;

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(this.props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;
    return _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'footer'))
    }), children);
  };

  return PanelFooter;
}(_react.default.Component);

PanelFooter.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('panel', PanelFooter);

exports.default = _default;
module.exports = exports["default"];