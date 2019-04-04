'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = areOptionsEqual;

var _shallowEqual = require('./utils/shallowEqual');

var _shallowEqual2 = _interopRequireDefault(_shallowEqual);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function areOptionsEqual(nextOptions, currentOptions) {
	if (currentOptions === nextOptions) {
		return true;
	}

	return currentOptions !== null && nextOptions !== null && (0, _shallowEqual2.default)(currentOptions, nextOptions);
}