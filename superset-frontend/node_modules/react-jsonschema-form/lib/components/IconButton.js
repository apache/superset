"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require("babel-runtime/helpers/objectWithoutProperties");

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

exports.default = IconButton;

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function IconButton(props) {
  var _props$type = props.type,
      type = _props$type === undefined ? "default" : _props$type,
      icon = props.icon,
      className = props.className,
      otherProps = (0, _objectWithoutProperties3.default)(props, ["type", "icon", "className"]);

  return _react2.default.createElement(
    "button",
    (0, _extends3.default)({
      type: "button",
      className: "btn btn-" + type + " " + className
    }, otherProps),
    _react2.default.createElement("i", { className: "glyphicon glyphicon-" + icon })
  );
}