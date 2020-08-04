"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isValidIdentifier;

var _esutils = _interopRequireDefault(require("esutils"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isValidIdentifier(name, reserved = true) {
  if (typeof name !== "string") return false;

  if (reserved) {
    if (_esutils.default.keyword.isReservedWordES6(name, true)) {
      return false;
    } else if (name === "await") {
      return false;
    }
  }

  return _esutils.default.keyword.isIdentifierNameES6(name);
}