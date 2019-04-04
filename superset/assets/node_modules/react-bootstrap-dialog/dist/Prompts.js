"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PasswordPrompt = exports.TextPrompt = exports.DialogPrompt = undefined;

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The class to represent prompt options
 */
var DialogPrompt = exports.DialogPrompt = function DialogPrompt() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  (0, _classCallCheck3.default)(this, DialogPrompt);
  var initialValue = options.initialValue,
      placeholder = options.placeholder;

  this.initialValue = initialValue;
  this.placeholder = placeholder;
};

/**
 * The class to represent text prompt options
 */


var TextPrompt = exports.TextPrompt = function (_DialogPrompt) {
  (0, _inherits3.default)(TextPrompt, _DialogPrompt);

  function TextPrompt() {
    (0, _classCallCheck3.default)(this, TextPrompt);
    return (0, _possibleConstructorReturn3.default)(this, (TextPrompt.__proto__ || (0, _getPrototypeOf2.default)(TextPrompt)).apply(this, arguments));
  }

  return TextPrompt;
}(DialogPrompt);

/**
 * The class to represent passowrd prompt options
 */


var PasswordPrompt = exports.PasswordPrompt = function (_DialogPrompt2) {
  (0, _inherits3.default)(PasswordPrompt, _DialogPrompt2);

  function PasswordPrompt() {
    (0, _classCallCheck3.default)(this, PasswordPrompt);
    return (0, _possibleConstructorReturn3.default)(this, (PasswordPrompt.__proto__ || (0, _getPrototypeOf2.default)(PasswordPrompt)).apply(this, arguments));
  }

  return PasswordPrompt;
}(DialogPrompt);