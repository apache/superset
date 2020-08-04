"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _Button = _interopRequireDefault(require("./Button"));

var _Dropdown = _interopRequireDefault(require("./Dropdown"));

var _SplitToggle = _interopRequireDefault(require("./SplitToggle"));

var _splitComponentProps2 = _interopRequireDefault(require("./utils/splitComponentProps"));

var propTypes = (0, _extends2.default)({}, _Dropdown.default.propTypes, {
  // Toggle props.
  bsStyle: _propTypes.default.string,
  bsSize: _propTypes.default.string,
  href: _propTypes.default.string,
  onClick: _propTypes.default.func,

  /**
   * The content of the split button.
   */
  title: _propTypes.default.node.isRequired,

  /**
   * Accessible label for the toggle; the value of `title` if not specified.
   */
  toggleLabel: _propTypes.default.string,
  // Override generated docs from <Dropdown>.

  /**
   * @private
   */
  children: _propTypes.default.node
});

var SplitButton =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(SplitButton, _React$Component);

  function SplitButton() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = SplitButton.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        bsSize = _this$props.bsSize,
        bsStyle = _this$props.bsStyle,
        title = _this$props.title,
        toggleLabel = _this$props.toggleLabel,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["bsSize", "bsStyle", "title", "toggleLabel", "children"]);

    var _splitComponentProps = (0, _splitComponentProps2.default)(props, _Dropdown.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        buttonProps = _splitComponentProps[1];

    return _react.default.createElement(_Dropdown.default, (0, _extends2.default)({}, dropdownProps, {
      bsSize: bsSize,
      bsStyle: bsStyle
    }), _react.default.createElement(_Button.default, (0, _extends2.default)({}, buttonProps, {
      disabled: props.disabled,
      bsSize: bsSize,
      bsStyle: bsStyle
    }), title), _react.default.createElement(_SplitToggle.default, {
      "aria-label": toggleLabel || title,
      bsSize: bsSize,
      bsStyle: bsStyle
    }), _react.default.createElement(_Dropdown.default.Menu, null, children));
  };

  return SplitButton;
}(_react.default.Component);

SplitButton.propTypes = propTypes;
SplitButton.Toggle = _SplitToggle.default;
var _default = SplitButton;
exports.default = _default;
module.exports = exports["default"];