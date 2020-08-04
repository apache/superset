'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _highlight = require('./highlight');

var _highlight2 = _interopRequireDefault(_highlight);

var _prism = require('./styles/prism/prism');

var _prism2 = _interopRequireDefault(_prism);

var _refractor = require('refractor');

var _refractor2 = _interopRequireDefault(_refractor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _highlight2.default)(_refractor2.default, _prism2.default);