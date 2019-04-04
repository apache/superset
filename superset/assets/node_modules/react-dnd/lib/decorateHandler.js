'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = decorateHandler;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _disposables = require('disposables');

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _hoistNonReactStatics = require('hoist-non-react-statics');

var _hoistNonReactStatics2 = _interopRequireDefault(_hoistNonReactStatics);

var _shallowEqual = require('./utils/shallowEqual');

var _shallowEqual2 = _interopRequireDefault(_shallowEqual);

var _shallowEqualScalar = require('./utils/shallowEqualScalar');

var _shallowEqualScalar2 = _interopRequireDefault(_shallowEqualScalar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var isClassComponent = function isClassComponent(Comp) {
	return Boolean(Comp && Comp.prototype && typeof Comp.prototype.render === 'function');
};

function decorateHandler(_ref) {
	var _class, _temp;

	var DecoratedComponent = _ref.DecoratedComponent,
	    createHandler = _ref.createHandler,
	    createMonitor = _ref.createMonitor,
	    createConnector = _ref.createConnector,
	    registerHandler = _ref.registerHandler,
	    containerDisplayName = _ref.containerDisplayName,
	    getType = _ref.getType,
	    collect = _ref.collect,
	    options = _ref.options;
	var _options$arePropsEqua = options.arePropsEqual,
	    arePropsEqual = _options$arePropsEqua === undefined ? _shallowEqualScalar2.default : _options$arePropsEqua;

	var displayName = DecoratedComponent.displayName || DecoratedComponent.name || 'Component';

	var DragDropContainer = (_temp = _class = function (_Component) {
		_inherits(DragDropContainer, _Component);

		_createClass(DragDropContainer, [{
			key: 'getHandlerId',
			value: function getHandlerId() {
				return this.handlerId;
			}
		}, {
			key: 'getDecoratedComponentInstance',
			value: function getDecoratedComponentInstance() {
				return this.decoratedComponentInstance;
			}
		}, {
			key: 'shouldComponentUpdate',
			value: function shouldComponentUpdate(nextProps, nextState) {
				return !arePropsEqual(nextProps, this.props) || !(0, _shallowEqual2.default)(nextState, this.state);
			}
		}]);

		function DragDropContainer(props, context) {
			_classCallCheck(this, DragDropContainer);

			var _this = _possibleConstructorReturn(this, (DragDropContainer.__proto__ || Object.getPrototypeOf(DragDropContainer)).call(this, props, context));

			_this.handleChange = _this.handleChange.bind(_this);
			_this.handleChildRef = _this.handleChildRef.bind(_this);

			(0, _invariant2.default)(_typeof(_this.context.dragDropManager) === 'object', 'Could not find the drag and drop manager in the context of %s. ' + 'Make sure to wrap the top-level component of your app with DragDropContext. ' + 'Read more: http://react-dnd.github.io/react-dnd/docs-troubleshooting.html#could-not-find-the-drag-and-drop-manager-in-the-context', displayName, displayName);

			_this.manager = _this.context.dragDropManager;
			_this.handlerMonitor = createMonitor(_this.manager);
			_this.handlerConnector = createConnector(_this.manager.getBackend());
			_this.handler = createHandler(_this.handlerMonitor);

			_this.disposable = new _disposables.SerialDisposable();
			_this.receiveProps(props);
			_this.state = _this.getCurrentState();
			_this.dispose();
			return _this;
		}

		_createClass(DragDropContainer, [{
			key: 'componentDidMount',
			value: function componentDidMount() {
				this.isCurrentlyMounted = true;
				this.disposable = new _disposables.SerialDisposable();
				this.currentType = null;
				this.receiveProps(this.props);
				this.handleChange();
			}
		}, {
			key: 'componentWillReceiveProps',
			value: function componentWillReceiveProps(nextProps) {
				if (!arePropsEqual(nextProps, this.props)) {
					this.receiveProps(nextProps);
					this.handleChange();
				}
			}
		}, {
			key: 'componentWillUnmount',
			value: function componentWillUnmount() {
				this.dispose();
				this.isCurrentlyMounted = false;
			}
		}, {
			key: 'receiveProps',
			value: function receiveProps(props) {
				this.handler.receiveProps(props);
				this.receiveType(getType(props));
			}
		}, {
			key: 'receiveType',
			value: function receiveType(type) {
				if (type === this.currentType) {
					return;
				}

				this.currentType = type;

				var _registerHandler = registerHandler(type, this.handler, this.manager),
				    handlerId = _registerHandler.handlerId,
				    unregister = _registerHandler.unregister;

				this.handlerId = handlerId;
				this.handlerMonitor.receiveHandlerId(handlerId);
				this.handlerConnector.receiveHandlerId(handlerId);

				var globalMonitor = this.manager.getMonitor();
				var unsubscribe = globalMonitor.subscribeToStateChange(this.handleChange, { handlerIds: [handlerId] });

				this.disposable.setDisposable(new _disposables.CompositeDisposable(new _disposables.Disposable(unsubscribe), new _disposables.Disposable(unregister)));
			}
		}, {
			key: 'handleChange',
			value: function handleChange() {
				if (!this.isCurrentlyMounted) {
					return;
				}

				var nextState = this.getCurrentState();
				if (!(0, _shallowEqual2.default)(nextState, this.state)) {
					this.setState(nextState);
				}
			}
		}, {
			key: 'dispose',
			value: function dispose() {
				this.disposable.dispose();
				this.handlerConnector.receiveHandlerId(null);
			}
		}, {
			key: 'handleChildRef',
			value: function handleChildRef(component) {
				this.decoratedComponentInstance = component;
				this.handler.receiveComponent(component);
			}
		}, {
			key: 'getCurrentState',
			value: function getCurrentState() {
				var nextState = collect(this.handlerConnector.hooks, this.handlerMonitor);

				if (process.env.NODE_ENV !== 'production') {
					(0, _invariant2.default)((0, _isPlainObject2.default)(nextState), 'Expected `collect` specified as the second argument to ' + '%s for %s to return a plain object of props to inject. ' + 'Instead, received %s.', containerDisplayName, displayName, nextState);
				}

				return nextState;
			}
		}, {
			key: 'render',
			value: function render() {
				return _react2.default.createElement(DecoratedComponent, _extends({}, this.props, this.state, {
					ref: isClassComponent(DecoratedComponent) ? this.handleChildRef : null
				}));
			}
		}]);

		return DragDropContainer;
	}(_react.Component), _class.DecoratedComponent = DecoratedComponent, _class.displayName = containerDisplayName + '(' + displayName + ')', _class.contextTypes = {
		dragDropManager: _propTypes2.default.object.isRequired
	}, _temp);


	return (0, _hoistNonReactStatics2.default)(DragDropContainer, DecoratedComponent);
}