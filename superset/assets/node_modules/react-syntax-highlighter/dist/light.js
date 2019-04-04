'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registerLanguage = undefined;

var _highlight = require('./highlight');

var _highlight2 = _interopRequireDefault(_highlight);

var _core = require('lowlight/lib/core');

var _core2 = _interopRequireDefault(_core);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var registerLanguage = exports.registerLanguage = _core2.default.registerLanguage;
exports.default = (0, _highlight2.default)(_core2.default, {});