'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getEmptyImage = exports.NativeTypes = undefined;
exports.default = createHTML5Backend;

var _HTML5Backend = require('./HTML5Backend');

var _HTML5Backend2 = _interopRequireDefault(_HTML5Backend);

var _getEmptyImage = require('./getEmptyImage');

var _getEmptyImage2 = _interopRequireDefault(_getEmptyImage);

var _NativeTypes = require('./NativeTypes');

var NativeTypes = _interopRequireWildcard(_NativeTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.NativeTypes = NativeTypes;
exports.getEmptyImage = _getEmptyImage2.default;
function createHTML5Backend(manager) {
	return new _HTML5Backend2.default(manager);
}