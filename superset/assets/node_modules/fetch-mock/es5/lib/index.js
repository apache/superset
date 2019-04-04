'use strict';

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var setUpAndTearDown = require('./set-up-and-tear-down');
var fetchHandler = require('./fetch-handler');
var inspecting = require('./inspecting');

var FetchMock = (0, _assign2.default)({}, fetchHandler, setUpAndTearDown, inspecting);

FetchMock.config = {
	fallbackToNetwork: false,
	includeContentLength: true,
	sendAsJson: true,
	warnOnFallback: true,
	overwriteRoutes: undefined
};

FetchMock.createInstance = function (isLibrary) {
	var instance = (0, _create2.default)(FetchMock);
	instance._uncompiledRoutes = (this._uncompiledRoutes || []).slice();
	instance.routes = instance._uncompiledRoutes.map(function (config) {
		return instance.compileRoute(config);
	});
	instance.fallbackResponse = this.fallbackResponse || undefined;
	instance.config = (0, _assign2.default)({}, this.config || FetchMock.config);
	instance._calls = {};
	instance._calls = [];
	instance._holdingPromises = [];
	instance.bindMethods();
	if (isLibrary) {
		(0, _assign2.default)(instance, {
			MATCHED: true,
			UNMATCHED: false,
			fetchMock: instance
		});
	}
	return instance;
};

FetchMock.bindMethods = function () {
	this.fetchHandler = FetchMock.fetchHandler.bind(this);
	this.reset = this.restore = FetchMock.reset.bind(this);
	this.resetHistory = FetchMock.resetHistory.bind(this);
	this.resetBehavior = FetchMock.resetBehavior.bind(this);
};

FetchMock.sandbox = function () {
	// this construct allows us to create a fetch-mock instance which is also
	// a callable function, while circumventing circularity when defining the
	// object that this function should be bound to
	var proxy = function proxy(url, options) {
		return sandbox.fetchHandler(url, options);
	};

	var sandbox = (0, _assign2.default)(proxy, // Ensures that the entire returned object is a callable function
	FetchMock, // prototype methods
	this.createInstance() // instance data
	);

	sandbox.bindMethods();
	sandbox.isSandbox = true;
	return sandbox;
};

module.exports = FetchMock;