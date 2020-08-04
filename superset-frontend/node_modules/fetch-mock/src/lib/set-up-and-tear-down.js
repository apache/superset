const compileRoute = require('./compile-route');
const FetchMock = {};

const getPropertyComparer = (route, propName) => route2 =>
	(!route[propName] && !route2[propName]) ||
	route[propName] === route2[propName];

FetchMock.mock = function(matcher, response, options = {}) {
	let route;

	// Handle the variety of parameters accepted by mock (see README)
	if (matcher && response) {
		route = Object.assign(
			{
				matcher,
				response
			},
			options
		);
	} else if (matcher && matcher.matcher) {
		route = matcher;
	} else {
		throw new Error('fetch-mock: Invalid parameters passed to fetch-mock');
	}

	this.addRoute(route);

	return this._mock();
};

FetchMock.addRoute = function(uncompiledRoute) {
	const route = this.compileRoute(uncompiledRoute);
	const clashes = this.routes.filter(getPropertyComparer(route, 'identifier'));

	const overwriteRoutes =
		'overwriteRoutes' in route
			? route.overwriteRoutes
			: this.config.overwriteRoutes;

	if (overwriteRoutes === false || !clashes.length) {
		this._uncompiledRoutes.push(uncompiledRoute);
		return this.routes.push(route);
	}

	const methodsMatch = getPropertyComparer(route, 'method');

	if (overwriteRoutes === true) {
		const index = this.routes.indexOf(clashes.find(methodsMatch));
		this._uncompiledRoutes.splice(index, 1, uncompiledRoute);
		return this.routes.splice(index, 1, route);
	}

	if (
		clashes.some(existingRoute => !route.method || methodsMatch(existingRoute))
	) {
		throw new Error(
			'fetch-mock: Adding route with same name or matcher as existing route. See `overwriteRoutes` option.'
		);
	}

	this._uncompiledRoutes.push(uncompiledRoute);
	this.routes.push(route);
};

FetchMock._mock = function() {
	if (!this.isSandbox) {
		// Do this here rather than in the constructor to ensure it's scoped to the test
		this.realFetch = this.realFetch || this.global.fetch;
		this.global.fetch = this.fetchHandler;
	}
	return this;
};

FetchMock.catch = function(response) {
	if (this.fallbackResponse) {
		console.warn(
			'calling fetchMock.catch() twice - are you sure you want to overwrite the previous fallback response'
		); // eslint-disable-line
	}
	this.fallbackResponse = response || 'ok';
	return this._mock();
};

FetchMock.spy = function() {
	this._mock();
	return this.catch(this.getNativeFetch());
};

FetchMock.compileRoute = compileRoute;

FetchMock.once = function(matcher, response, options = {}) {
	return this.mock(
		matcher,
		response,
		Object.assign({}, options, { repeat: 1 })
	);
};

['get', 'post', 'put', 'delete', 'head', 'patch'].forEach(method => {
	const extendOptions = options =>
		Object.assign({}, options, { method: method.toUpperCase() });

	FetchMock[method] = function(matcher, response, options = {}) {
		return this.mock(matcher, response, extendOptions(options));
	};
	FetchMock[`${method}Once`] = function(matcher, response, options = {}) {
		return this.once(matcher, response, extendOptions(options));
	};
});

FetchMock.resetBehavior = function() {
	if (this.realFetch) {
		this.global.fetch = this.realFetch;
		this.realFetch = undefined;
	}
	this.fallbackResponse = undefined;
	this.routes = [];
	this._uncompiledRoutes = [];
	return this;
};

FetchMock.resetHistory = function() {
	this._calls = {};
	this._calls = [];
	this._holdingPromises = [];
	this.routes.forEach(route => route.reset && route.reset());
	return this;
};

FetchMock.restore = FetchMock.reset = function() {
	this.resetBehavior();
	this.resetHistory();
	return this;
};

module.exports = FetchMock;
