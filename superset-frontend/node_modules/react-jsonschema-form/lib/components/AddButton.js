"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = AddButton;

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _IconButton = require("./IconButton");

var _IconButton2 = _interopRequireDefault(_IconButton);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function AddButton(_ref) {
  var className = _ref.className,
      onClick = _ref.onClick,
      disabled = _ref.disabled;

  return _react2.default.createElement(
    "div",
    { className: "row" },
    _react2.default.createElement(
      "p",
      { className: "col-xs-3 col-xs-offset-9 text-right " + className },
      _react2.default.createElement(_IconButton2.default, {
        type: "info",
        icon: "plus",
        className: "btn-add col-xs-12",
        tabIndex: "0",
        onClick: onClick,
        disabled: disabled
      })
    )
  );
}