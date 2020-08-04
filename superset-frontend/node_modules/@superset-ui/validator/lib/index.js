"use strict";

exports.__esModule = true;
exports.validateNonEmpty = exports.validateNumber = exports.validateInteger = exports.legacyValidateNumber = exports.legacyValidateInteger = void 0;

var _legacyValidateInteger = _interopRequireDefault(require("./legacyValidateInteger"));

exports.legacyValidateInteger = _legacyValidateInteger.default;

var _legacyValidateNumber = _interopRequireDefault(require("./legacyValidateNumber"));

exports.legacyValidateNumber = _legacyValidateNumber.default;

var _validateInteger = _interopRequireDefault(require("./validateInteger"));

exports.validateInteger = _validateInteger.default;

var _validateNumber = _interopRequireDefault(require("./validateNumber"));

exports.validateNumber = _validateNumber.default;

var _validateNonEmpty = _interopRequireDefault(require("./validateNonEmpty"));

exports.validateNonEmpty = _validateNonEmpty.default;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }