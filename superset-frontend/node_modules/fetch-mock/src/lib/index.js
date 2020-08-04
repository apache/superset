const setUpAndTearDown = require('./set-up-and-tear-down');
const fetchHandler = require('./fetch-handler');
const inspecting = require('./inspecting');

const FetchMock = Object.assign({}, fetchHandler, setUpAndTearDown, inspecting);

FetchMock.config = {
	fallbackToNetwork: false,
	includeContentLength: true,
	sendAsJson: true,
	warnOnFallback: true,
	overwriteRoutes: undefined
};

FetchMock.createInstance = function(isLibrary) {
	const instance = Object.create(FetchMock);
	instance._uncompiledRoutes = (this._uncompiledRoutes || []).slice();
	instance.routes = instance._uncompiledRoutes.map(config =>
		instance.compileRoute(config)
	);
	instance.fallbackResponse = this.fallbackResponse || undefined;
	instance.config = Object.assign({}, this.config || FetchMock.config);
	instance._calls = {};
	instance._calls = [];
	instance._holdingPromises = [];
	instance.bindMethods();
	if (isLibrary) {
		Object.assign(instance, {
			MATCHED: true,
			UNMATCHED: false,
			fetchMock: instance
		});
	}
	return instance;
};

FetchMock.bindMethods = function() {
	this.fetchHandler = FetchMock.fetchHandler.bind(this);
	this.reset = this.restore = FetchMock.reset.bind(this);
	this.resetHistory = FetchMock.resetHistory.bind(this);
	this.resetBehavior = FetchMock.resetBehavior.bind(this);
};

FetchMock.sandbox = function() {
	// this construct allows us to create a fetch-mock instance which is also
	// a callable function, while circumventing circularity when defining the
	// object that this function should be bound to
	const proxy = (url, options) => sandbox.fetchHandler(url, options);

	const sandbox = Object.assign(
		proxy, // Ensures that the entire returned object is a callable function
		FetchMock, // prototype methods
		this.createInstance() // instance data
	);

	sandbox.bindMethods();
	sandbox.isSandbox = true;
	return sandbox;
};

module.exports = FetchMock;
