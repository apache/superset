'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _xregexp = require('./xregexp');

var _xregexp2 = _interopRequireDefault(_xregexp);

var _build = require('./addons/build');

var _build2 = _interopRequireDefault(_build);

var _matchrecursive = require('./addons/matchrecursive');

var _matchrecursive2 = _interopRequireDefault(_matchrecursive);

var _unicodeBase = require('./addons/unicode-base');

var _unicodeBase2 = _interopRequireDefault(_unicodeBase);

var _unicodeBlocks = require('./addons/unicode-blocks');

var _unicodeBlocks2 = _interopRequireDefault(_unicodeBlocks);

var _unicodeCategories = require('./addons/unicode-categories');

var _unicodeCategories2 = _interopRequireDefault(_unicodeCategories);

var _unicodeProperties = require('./addons/unicode-properties');

var _unicodeProperties2 = _interopRequireDefault(_unicodeProperties);

var _unicodeScripts = require('./addons/unicode-scripts');

var _unicodeScripts2 = _interopRequireDefault(_unicodeScripts);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _build2.default)(_xregexp2.default);
(0, _matchrecursive2.default)(_xregexp2.default);
(0, _unicodeBase2.default)(_xregexp2.default);
(0, _unicodeBlocks2.default)(_xregexp2.default);
(0, _unicodeCategories2.default)(_xregexp2.default);
(0, _unicodeProperties2.default)(_xregexp2.default);
(0, _unicodeScripts2.default)(_xregexp2.default);

exports.default = _xregexp2.default;
module.exports = exports['default'];