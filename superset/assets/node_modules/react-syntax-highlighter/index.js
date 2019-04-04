'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createElement = undefined;

var _createElement = require('./create-element');

Object.defineProperty(exports, 'createElement', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_createElement).default;
  }
});

var _highlight = require('./highlight');

var _highlight2 = _interopRequireDefault(_highlight);

var _defaultStyle = require('./styles/hljs/default-style');

var _defaultStyle2 = _interopRequireDefault(_defaultStyle);

var _lowlight = require('lowlight');

var _lowlight2 = _interopRequireDefault(_lowlight);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _highlight2.default)(_lowlight2.default, _defaultStyle2.default);