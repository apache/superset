'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = createSourceMonitor;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var isCallingCanDrag = false;
var isCallingIsDragging = false;

var SourceMonitor = function () {
	function SourceMonitor(manager) {
		_classCallCheck(this, SourceMonitor);

		this.internalMonitor = manager.getMonitor();
	}

	_createClass(SourceMonitor, [{
		key: 'receiveHandlerId',
		value: function receiveHandlerId(sourceId) {
			this.sourceId = sourceId;
		}
	}, {
		key: 'canDrag',
		value: function canDrag() {
			(0, _invariant2.default)(!isCallingCanDrag, 'You may not call monitor.canDrag() inside your canDrag() implementation. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source-monitor.html');

			try {
				isCallingCanDrag = true;
				return this.internalMonitor.canDragSource(this.sourceId);
			} finally {
				isCallingCanDrag = false;
			}
		}
	}, {
		key: 'isDragging',
		value: function isDragging() {
			(0, _invariant2.default)(!isCallingIsDragging, 'You may not call monitor.isDragging() inside your isDragging() implementation. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source-monitor.html');

			try {
				isCallingIsDragging = true;
				return this.internalMonitor.isDraggingSource(this.sourceId);
			} finally {
				isCallingIsDragging = false;
			}
		}
	}, {
		key: 'getItemType',
		value: function getItemType() {
			return this.internalMonitor.getItemType();
		}
	}, {
		key: 'getItem',
		value: function getItem() {
			return this.internalMonitor.getItem();
		}
	}, {
		key: 'getDropResult',
		value: function getDropResult() {
			return this.internalMonitor.getDropResult();
		}
	}, {
		key: 'didDrop',
		value: function didDrop() {
			return this.internalMonitor.didDrop();
		}
	}, {
		key: 'getInitialClientOffset',
		value: function getInitialClientOffset() {
			return this.internalMonitor.getInitialClientOffset();
		}
	}, {
		key: 'getInitialSourceClientOffset',
		value: function getInitialSourceClientOffset() {
			return this.internalMonitor.getInitialSourceClientOffset();
		}
	}, {
		key: 'getSourceClientOffset',
		value: function getSourceClientOffset() {
			return this.internalMonitor.getSourceClientOffset();
		}
	}, {
		key: 'getClientOffset',
		value: function getClientOffset() {
			return this.internalMonitor.getClientOffset();
		}
	}, {
		key: 'getDifferenceFromInitialOffset',
		value: function getDifferenceFromInitialOffset() {
			return this.internalMonitor.getDifferenceFromInitialOffset();
		}
	}]);

	return SourceMonitor;
}();

function createSourceMonitor(manager) {
	return new SourceMonitor(manager);
}