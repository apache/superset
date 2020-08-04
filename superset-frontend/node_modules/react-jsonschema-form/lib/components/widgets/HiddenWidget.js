"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function HiddenWidget(_ref) {
  var id = _ref.id,
      value = _ref.value;

  return _react2.default.createElement("input", {
    type: "hidden",
    id: id,
    value: typeof value === "undefined" ? "" : value
  });
}

if (process.env.NODE_ENV !== "production") {
  HiddenWidget.propTypes = {
    id: _propTypes2.default.string.isRequired,
    value: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number, _propTypes2.default.bool])
  };
}

exports.default = HiddenWidget;