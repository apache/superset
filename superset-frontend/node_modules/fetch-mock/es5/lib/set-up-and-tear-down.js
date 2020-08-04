'use strict';

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var compileRoute = require('./compile-route');
var FetchMock = {};

var getPropertyComparer = function getPropertyComparer(route, propName) {
	return function (route2) {
		return !route[propName] && !route2[propName] || route[propName] === route2[propName];
	};
};

FetchMock.mock = function (matcher, response) {
	var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

	var route = void 0;

	// Handle the variety of parameters accepted by mock (see README)
	if (matcher && response) {
		route = (0, _assign2.default)({
			matcher: matcher,
			response: response
		}, options);
	} else if (matcher && matcher.matcher) {
		route = matcher;
	} else {
		throw new Error('fetch-mock: Invalid parameters passed to fetch-mock');
	}

	this.addRoute(route);

	return this._mock();
};

FetchMock.addRoute = function (uncompiledRoute) {
	var route = this.compileRoute(uncompiledRoute);
	var clashes = this.routes.filter(getPropertyComparer(route, 'identifier'));

	var overwriteRoutes = 'overwriteRoutes' in route ? route.overwriteRoutes : this.config.overwriteRoutes;

	if (overwriteRoutes === false || !clashes.length) {
		this._uncompiledRoutes.push(uncompiledRoute);
		return this.routes.push(route);
	}

	var methodsMatch = getPropertyComparer(route, 'method');

	if (overwriteRoutes === true) {
		var index = this.routes.indexOf(clashes.find(methodsMatch));
		this._uncompiledRoutes.splice(index, 1, uncompiledRoute);
		return this.routes.splice(index, 1, route);
	}

	if (clashes.some(function (existingRoute) {
		return !route.method || methodsMatch(existingRoute);
	})) {
		throw new Error('fetch-mock: Adding route with same name or matcher as existing route. See `overwriteRoutes` option.');
	}

	this._uncompiledRoutes.push(uncompiledRoute);
	this.routes.push(route);
};

FetchMock._mock = function () {
	if (!this.isSandbox) {
		// Do this here rather than in the constructor to ensure it's scoped to the test
		this.realFetch = this.realFetch || this.global.fetch;
		this.global.fetch = this.fetchHandler;
	}
	return this;
};

FetchMock.catch = function (response) {
	if (this.fallbackResponse) {
		console.warn('calling fetchMock.catch() twice - are you sure you want to overwrite the previous fallback response'); // eslint-disable-line
	}
	this.fallbackResponse = response || 'ok';
	return this._mock();
};

FetchMock.spy = function () {
	this._mock();
	return this.catch(this.getNativeFetch());
};

FetchMock.compileRoute = compileRoute;

FetchMock.once = function (matcher, response) {
	var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

	return this.mock(matcher, response, (0, _assign2.default)({}, options, { repeat: 1 }));
};

['get', 'post', 'put', 'delete', 'head', 'patch'].forEach(function (method) {
	var extendOptions = function extendOptions(options) {
		return (0, _assign2.default)({}, options, { method: method.toUpperCase() });
	};

	FetchMock[method] = function (matcher, response) {
		var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		return this.mock(matcher, response, extendOptions(options));
	};
	FetchMock[method + 'Once'] = function (matcher, response) {
		var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		return this.once(matcher, response, extendOptions(options));
	};
});

FetchMock.resetBehavior = function () {
	if (this.realFetch) {
		this.global.fetch = this.realFetch;
		this.realFetch = undefined;
	}
	this.fallbackResponse = undefined;
	this.routes = [];
	this._uncompiledRoutes = [];
	return this;
};

FetchMock.resetHistory = function () {
	this._calls = {};
	this._calls = [];
	this._holdingPromises = [];
	this.routes.forEach(function (route) {
		return route.reset && route.reset();
	});
	return this;
};

FetchMock.restore = FetchMock.reset = function () {
	this.resetBehavior();
	this.resetHistory();
	return this;
};

module.exports = FetchMock;