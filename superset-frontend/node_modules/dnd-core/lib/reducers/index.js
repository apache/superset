'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = reduce;

var _dragOffset = require('./dragOffset');

var _dragOffset2 = _interopRequireDefault(_dragOffset);

var _dragOperation = require('./dragOperation');

var _dragOperation2 = _interopRequireDefault(_dragOperation);

var _refCount = require('./refCount');

var _refCount2 = _interopRequireDefault(_refCount);

var _dirtyHandlerIds = require('./dirtyHandlerIds');

var _dirtyHandlerIds2 = _interopRequireDefault(_dirtyHandlerIds);

var _stateId = require('./stateId');

var _stateId2 = _interopRequireDefault(_stateId);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reduce() {
	var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	var action = arguments[1];

	return {
		dirtyHandlerIds: (0, _dirtyHandlerIds2.default)(state.dirtyHandlerIds, action, state.dragOperation),
		dragOffset: (0, _dragOffset2.default)(state.dragOffset, action),
		refCount: (0, _refCount2.default)(state.refCount, action),
		dragOperation: (0, _dragOperation2.default)(state.dragOperation, action),
		stateId: (0, _stateId2.default)(state.stateId)
	};
}