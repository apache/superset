"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _all = _interopRequireDefault(require("prop-types-extra/lib/all"));

var _Button = _interopRequireDefault(require("./Button"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  vertical: _propTypes.default.bool,
  justified: _propTypes.default.bool,

  /**
   * Display block buttons; only useful when used with the "vertical" prop.
   * @type {bool}
   */
  block: (0, _all.default)(_propTypes.default.bool, function (_ref) {
    var block = _ref.block,
        vertical = _ref.vertical;
    return block && !vertical ? new Error('`block` requires `vertical` to be set to have any effect') : null;
  })
};
var defaultProps = {
  block: false,
  justified: false,
  vertical: false
};

var ButtonGroup =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(ButtonGroup, _React$Component);

  function ButtonGroup() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ButtonGroup.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        block = _this$props.block,
        justified = _this$props.justified,
        vertical = _this$props.vertical,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["block", "justified", "vertical", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps)] = !vertical, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'vertical')] = vertical, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'justified')] = justified, _extends2[(0, _bootstrapUtils.prefix)(_Button.default.defaultProps, 'block')] = block, _extends2));
    return _react.default.createElement("div", (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return ButtonGroup;
}(_react.default.Component);

ButtonGroup.propTypes = propTypes;
ButtonGroup.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('btn-group', ButtonGroup);

exports.default = _default;
module.exports = exports["default"];