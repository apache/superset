'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = DragSource;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _checkDecoratorArguments = require('./utils/checkDecoratorArguments');

var _checkDecoratorArguments2 = _interopRequireDefault(_checkDecoratorArguments);

var _decorateHandler = require('./decorateHandler');

var _decorateHandler2 = _interopRequireDefault(_decorateHandler);

var _registerSource = require('./registerSource');

var _registerSource2 = _interopRequireDefault(_registerSource);

var _createSourceFactory = require('./createSourceFactory');

var _createSourceFactory2 = _interopRequireDefault(_createSourceFactory);

var _createSourceMonitor = require('./createSourceMonitor');

var _createSourceMonitor2 = _interopRequireDefault(_createSourceMonitor);

var _createSourceConnector = require('./createSourceConnector');

var _createSourceConnector2 = _interopRequireDefault(_createSourceConnector);

var _isValidType = require('./utils/isValidType');

var _isValidType2 = _interopRequireDefault(_isValidType);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function DragSource(type, spec, collect) {
	var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

	_checkDecoratorArguments2.default.apply(undefined, ['DragSource', 'type, spec, collect[, options]'].concat(Array.prototype.slice.call(arguments)));
	var getType = type;
	if (typeof type !== 'function') {
		(0, _invariant2.default)((0, _isValidType2.default)(type), 'Expected "type" provided as the first argument to DragSource to be ' + 'a string, or a function that returns a string given the current props. ' + 'Instead, received %s. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source.html', type);
		getType = function getType() {
			return type;
		};
	}
	(0, _invariant2.default)((0, _isPlainObject2.default)(spec), 'Expected "spec" provided as the second argument to DragSource to be ' + 'a plain object. Instead, received %s. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source.html', spec);
	var createSource = (0, _createSourceFactory2.default)(spec);
	(0, _invariant2.default)(typeof collect === 'function', 'Expected "collect" provided as the third argument to DragSource to be ' + 'a function that returns a plain object of props to inject. ' + 'Instead, received %s. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source.html', collect);
	(0, _invariant2.default)((0, _isPlainObject2.default)(options), 'Expected "options" provided as the fourth argument to DragSource to be ' + 'a plain object when specified. ' + 'Instead, received %s. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-source.html', collect);

	return function decorateSource(DecoratedComponent) {
		return (0, _decorateHandler2.default)({
			connectBackend: function connectBackend(backend, sourceId) {
				return backend.connectDragSource(sourceId);
			},
			containerDisplayName: 'DragSource',
			createHandler: createSource,
			registerHandler: _registerSource2.default,
			createMonitor: _createSourceMonitor2.default,
			createConnector: _createSourceConnector2.default,
			DecoratedComponent: DecoratedComponent,
			getType: getType,
			collect: collect,
			options: options
		});
	};
}