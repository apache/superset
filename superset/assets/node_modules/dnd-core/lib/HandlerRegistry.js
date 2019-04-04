'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _asap = require('asap');

var _asap2 = _interopRequireDefault(_asap);

var _registry = require('./actions/registry');

var _getNextUniqueId = require('./utils/getNextUniqueId');

var _getNextUniqueId2 = _interopRequireDefault(_getNextUniqueId);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HandlerRoles = {
	SOURCE: 'SOURCE',
	TARGET: 'TARGET'
};

function validateSourceContract(source) {
	(0, _invariant2.default)(typeof source.canDrag === 'function', 'Expected canDrag to be a function.');
	(0, _invariant2.default)(typeof source.beginDrag === 'function', 'Expected beginDrag to be a function.');
	(0, _invariant2.default)(typeof source.endDrag === 'function', 'Expected endDrag to be a function.');
}

function validateTargetContract(target) {
	(0, _invariant2.default)(typeof target.canDrop === 'function', 'Expected canDrop to be a function.');
	(0, _invariant2.default)(typeof target.hover === 'function', 'Expected hover to be a function.');
	(0, _invariant2.default)(typeof target.drop === 'function', 'Expected beginDrag to be a function.');
}

function validateType(type, allowArray) {
	if (allowArray && (0, _isArray2.default)(type)) {
		type.forEach(function (t) {
			return validateType(t, false);
		});
		return;
	}

	(0, _invariant2.default)(typeof type === 'string' || (typeof type === 'undefined' ? 'undefined' : _typeof(type)) === 'symbol', allowArray ? 'Type can only be a string, a symbol, or an array of either.' : 'Type can only be a string or a symbol.');
}

function getNextHandlerId(role) {
	var id = (0, _getNextUniqueId2.default)().toString();
	switch (role) {
		case HandlerRoles.SOURCE:
			return 'S' + id;
		case HandlerRoles.TARGET:
			return 'T' + id;
		default:
			(0, _invariant2.default)(false, 'Unknown role: ' + role);
	}
}

function parseRoleFromHandlerId(handlerId) {
	switch (handlerId[0]) {
		case 'S':
			return HandlerRoles.SOURCE;
		case 'T':
			return HandlerRoles.TARGET;
		default:
			(0, _invariant2.default)(false, 'Cannot parse handler ID: ' + handlerId);
	}
}

var HandlerRegistry = function () {
	function HandlerRegistry(store) {
		_classCallCheck(this, HandlerRegistry);

		this.store = store;

		this.types = {};
		this.handlers = {};

		this.pinnedSourceId = null;
		this.pinnedSource = null;
	}

	_createClass(HandlerRegistry, [{
		key: 'addSource',
		value: function addSource(type, source) {
			validateType(type);
			validateSourceContract(source);

			var sourceId = this.addHandler(HandlerRoles.SOURCE, type, source);
			this.store.dispatch((0, _registry.addSource)(sourceId));
			return sourceId;
		}
	}, {
		key: 'addTarget',
		value: function addTarget(type, target) {
			validateType(type, true);
			validateTargetContract(target);

			var targetId = this.addHandler(HandlerRoles.TARGET, type, target);
			this.store.dispatch((0, _registry.addTarget)(targetId));
			return targetId;
		}
	}, {
		key: 'addHandler',
		value: function addHandler(role, type, handler) {
			var id = getNextHandlerId(role);
			this.types[id] = type;
			this.handlers[id] = handler;

			return id;
		}
	}, {
		key: 'containsHandler',
		value: function containsHandler(handler) {
			var _this = this;

			return Object.keys(this.handlers).some(function (key) {
				return _this.handlers[key] === handler;
			});
		}
	}, {
		key: 'getSource',
		value: function getSource(sourceId, includePinned) {
			(0, _invariant2.default)(this.isSourceId(sourceId), 'Expected a valid source ID.');

			var isPinned = includePinned && sourceId === this.pinnedSourceId;
			var source = isPinned ? this.pinnedSource : this.handlers[sourceId];

			return source;
		}
	}, {
		key: 'getTarget',
		value: function getTarget(targetId) {
			(0, _invariant2.default)(this.isTargetId(targetId), 'Expected a valid target ID.');
			return this.handlers[targetId];
		}
	}, {
		key: 'getSourceType',
		value: function getSourceType(sourceId) {
			(0, _invariant2.default)(this.isSourceId(sourceId), 'Expected a valid source ID.');
			return this.types[sourceId];
		}
	}, {
		key: 'getTargetType',
		value: function getTargetType(targetId) {
			(0, _invariant2.default)(this.isTargetId(targetId), 'Expected a valid target ID.');
			return this.types[targetId];
		}
	}, {
		key: 'isSourceId',
		value: function isSourceId(handlerId) {
			var role = parseRoleFromHandlerId(handlerId);
			return role === HandlerRoles.SOURCE;
		}
	}, {
		key: 'isTargetId',
		value: function isTargetId(handlerId) {
			var role = parseRoleFromHandlerId(handlerId);
			return role === HandlerRoles.TARGET;
		}
	}, {
		key: 'removeSource',
		value: function removeSource(sourceId) {
			var _this2 = this;

			(0, _invariant2.default)(this.getSource(sourceId), 'Expected an existing source.');
			this.store.dispatch((0, _registry.removeSource)(sourceId));

			(0, _asap2.default)(function () {
				delete _this2.handlers[sourceId];
				delete _this2.types[sourceId];
			});
		}
	}, {
		key: 'removeTarget',
		value: function removeTarget(targetId) {
			var _this3 = this;

			(0, _invariant2.default)(this.getTarget(targetId), 'Expected an existing target.');
			this.store.dispatch((0, _registry.removeTarget)(targetId));

			(0, _asap2.default)(function () {
				delete _this3.handlers[targetId];
				delete _this3.types[targetId];
			});
		}
	}, {
		key: 'pinSource',
		value: function pinSource(sourceId) {
			var source = this.getSource(sourceId);
			(0, _invariant2.default)(source, 'Expected an existing source.');

			this.pinnedSourceId = sourceId;
			this.pinnedSource = source;
		}
	}, {
		key: 'unpinSource',
		value: function unpinSource() {
			(0, _invariant2.default)(this.pinnedSource, 'No source is pinned at the time.');

			this.pinnedSourceId = null;
			this.pinnedSource = null;
		}
	}]);

	return HandlerRegistry;
}();

exports.default = HandlerRegistry;