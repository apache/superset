"use strict";

exports.__esModule = true;
exports.default = Ordinal;

var _react = _interopRequireDefault(require("react"));

var _Legend = _interopRequireDefault(require("./Legend"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** Ordinal scales map from strings to an Output type. */
function Ordinal(props) {
  return /*#__PURE__*/_react.default.createElement(_Legend.default, props);
}