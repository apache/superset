"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _Dropdown = _interopRequireDefault(require("./Dropdown"));

var _splitComponentProps2 = _interopRequireDefault(require("./utils/splitComponentProps"));

var propTypes = (0, _extends2.default)({}, _Dropdown.default.propTypes, {
  // Toggle props.
  bsStyle: _propTypes.default.string,
  bsSize: _propTypes.default.string,
  title: _propTypes.default.node.isRequired,
  noCaret: _propTypes.default.bool,
  // Override generated docs from <Dropdown>.

  /**
   * @private
   */
  children: _propTypes.default.node
});

var DropdownButton =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(DropdownButton, _React$Component);

  function DropdownButton() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = DropdownButton.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        bsSize = _this$props.bsSize,
        bsStyle = _this$props.bsStyle,
        title = _this$props.title,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["bsSize", "bsStyle", "title", "children"]);

    var _splitComponentProps = (0, _splitComponentProps2.default)(props, _Dropdown.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1];

    return _react.default.createElement(_Dropdown.default, (0, _extends2.default)({}, dropdownProps, {
      bsSize: bsSize,
      bsStyle: bsStyle
    }), _react.default.createElement(_Dropdown.default.Toggle, (0, _extends2.default)({}, toggleProps, {
      bsSize: bsSize,
      bsStyle: bsStyle
    }), title), _react.default.createElement(_Dropdown.default.Menu, null, children));
  };

  return DropdownButton;
}(_react.default.Component);

DropdownButton.propTypes = propTypes;
var _default = DropdownButton;
exports.default = _default;
module.exports = exports["default"];