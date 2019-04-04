'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.unpackBackendForEs5Users = exports.createChildContext = exports.CHILD_CONTEXT_TYPES = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = DragDropContext;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _dndCore = require('dnd-core');

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _hoistNonReactStatics = require('hoist-non-react-statics');

var _hoistNonReactStatics2 = _interopRequireDefault(_hoistNonReactStatics);

var _checkDecoratorArguments = require('./utils/checkDecoratorArguments');

var _checkDecoratorArguments2 = _interopRequireDefault(_checkDecoratorArguments);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CHILD_CONTEXT_TYPES = exports.CHILD_CONTEXT_TYPES = {
	dragDropManager: _propTypes2.default.object.isRequired
};

var createChildContext = exports.createChildContext = function createChildContext(backend, context) {
	return {
		dragDropManager: new _dndCore.DragDropManager(backend, context)
	};
};

var unpackBackendForEs5Users = exports.unpackBackendForEs5Users = function unpackBackendForEs5Users(backendOrModule) {
	// Auto-detect ES6 default export for people still using ES5
	var backend = backendOrModule;
	if ((typeof backend === 'undefined' ? 'undefined' : _typeof(backend)) === 'object' && typeof backend.default === 'function') {
		backend = backend.default;
	}
	(0, _invariant2.default)(typeof backend === 'function', 'Expected the backend to be a function or an ES6 module exporting a default function. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-drag-drop-context.html');
	return backend;
};

function DragDropContext(backendOrModule) {
	_checkDecoratorArguments2.default.apply(undefined, ['DragDropContext', 'backend'].concat(Array.prototype.slice.call(arguments))); // eslint-disable-line prefer-rest-params

	var backend = unpackBackendForEs5Users(backendOrModule);
	var childContext = createChildContext(backend);

	return function decorateContext(DecoratedComponent) {
		var _class, _temp;

		var displayName = DecoratedComponent.displayName || DecoratedComponent.name || 'Component';

		var DragDropContextContainer = (_temp = _class = function (_Component) {
			_inherits(DragDropContextContainer, _Component);

			function DragDropContextContainer() {
				_classCallCheck(this, DragDropContextContainer);

				return _possibleConstructorReturn(this, (DragDropContextContainer.__proto__ || Object.getPrototypeOf(DragDropContextContainer)).apply(this, arguments));
			}

			_createClass(DragDropContextContainer, [{
				key: 'getDecoratedComponentInstance',
				value: function getDecoratedComponentInstance() {
					(0, _invariant2.default)(this.child, 'In order to access an instance of the decorated component it can not be a stateless component.');
					return this.child;
				}
			}, {
				key: 'getManager',
				value: function getManager() {
					return childContext.dragDropManager;
				}
			}, {
				key: 'getChildContext',
				value: function getChildContext() {
					return childContext;
				}
			}, {
				key: 'render',
				value: function render() {
					var _this2 = this;

					return _react2.default.createElement(DecoratedComponent, _extends({}, this.props, {
						ref: function ref(child) {
							_this2.child = child;
						}
					}));
				}
			}]);

			return DragDropContextContainer;
		}(_react.Component), _class.DecoratedComponent = DecoratedComponent, _class.displayName = 'DragDropContext(' + displayName + ')', _class.childContextTypes = CHILD_CONTEXT_TYPES, _temp);


		return (0, _hoistNonReactStatics2.default)(DragDropContextContainer, DecoratedComponent);
	};
}