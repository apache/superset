'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ReactCSS = exports.loop = exports.handleActive = exports.handleHover = exports.hover = undefined;

var _flattenNames = require('./flattenNames');

var _flattenNames2 = _interopRequireDefault(_flattenNames);

var _mergeClasses = require('./mergeClasses');

var _mergeClasses2 = _interopRequireDefault(_mergeClasses);

var _autoprefix = require('./autoprefix');

var _autoprefix2 = _interopRequireDefault(_autoprefix);

var _hover2 = require('./components/hover');

var _hover3 = _interopRequireDefault(_hover2);

var _active = require('./components/active');

var _active2 = _interopRequireDefault(_active);

var _loop2 = require('./loop');

var _loop3 = _interopRequireDefault(_loop2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.hover = _hover3.default;
exports.handleHover = _hover3.default;
exports.handleActive = _active2.default;
exports.loop = _loop3.default;
var ReactCSS = exports.ReactCSS = function ReactCSS(classes) {
  for (var _len = arguments.length, activations = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    activations[_key - 1] = arguments[_key];
  }

  var activeNames = (0, _flattenNames2.default)(activations);
  var merged = (0, _mergeClasses2.default)(classes, activeNames);
  return (0, _autoprefix2.default)(merged);
};

exports.default = ReactCSS;