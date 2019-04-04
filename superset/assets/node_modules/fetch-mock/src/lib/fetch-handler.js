const responseBuilder = require('./response-builder');
const requestUtils = require('./request-utils');
const FetchMock = {};

const resolve = async (response, url, options, request) => {
	// We want to allow things like
	// - function returning a Promise for a response
	// - delaying (using a timeout Promise) a function's execution to generate
	//   a response
	// Because of this we can't safely check for function before Promisey-ness,
	// or vice versa. So to keep it DRY, and flexible, we keep trying until we
	// have something that looks like neither Promise nor function
	while (
		typeof response === 'function' ||
		typeof response.then === 'function'
	) {
		if (typeof response === 'function') {
			response = response(url, options, request);
		} else {
			response = await response;
		}
	}
	return response;
};

FetchMock.fetchHandler = function(url, options, request) {
	({ url, options, request } = requestUtils.normalizeRequest(
		url,
		options,
		this.config.Request
	));

	const route = this.executeRouter(url, options, request);

	// this is used to power the .flush() method
	let done;
	this._holdingPromises.push(new this.config.Promise(res => (done = res)));

	// wrapped in this promise to make sure we respect custom Promise
	// constructors defined by the user
	return new this.config.Promise((res, rej) => {
		if (options && options.signal) {
			options.signal.addEventListener('abort', () => {
				rej(new Error(`URL '${url}' aborted.`));
				done();
			});
		}

		this.generateResponse(route, url, options, request)
			.then(res, rej)
			.then(done, done);
	});
};

FetchMock.fetchHandler.isMock = true;

FetchMock.executeRouter = function(url, options, request) {
	if (this.config.fallbackToNetwork === 'always') {
		return { response: this.getNativeFetch() };
	}

	const match = this.router(url, options, request);

	if (match) {
		return match;
	}

	if (this.config.warnOnFallback) {
		console.warn(`Unmatched ${(options && options.method) || 'GET'} to ${url}`); // eslint-disable-line
	}

	this.push({ url, options, request, isUnmatched: true });

	if (this.fallbackResponse) {
		return { response: this.fallbackResponse };
	}

	if (!this.config.fallbackToNetwork) {
		throw new Error(
			`fetch-mock: No fallback response defined for ${(options &&
				options.method) ||
				'GET'} to ${url}`
		);
	}

	return { response: this.getNativeFetch() };
};

FetchMock.generateResponse = async function(route, url, options, request) {
	const response = await resolve(route.response, url, options, request);

	// If the response says to throw an error, throw it
	// Type checking is to deal with sinon spies having a throws property :-0
	if (response.throws && typeof response !== 'function') {
		throw response.throws;
	}

	// If the response is a pre-made Response, respond with it
	if (this.config.Response.prototype.isPrototypeOf(response)) {
		return response;
	}

	// finally, if we need to convert config into a response, we do it
	return responseBuilder({
		url,
		responseConfig: response,
		fetchMock: this,
		route
	});
};

FetchMock.router = function(url, options, request) {
	const route = this.routes.find(route => route.matcher(url, options, request));

	if (route) {
		this.push({
			url,
			options,
			request,
			identifier: route.identifier
		});
		return route;
	}
};

FetchMock.getNativeFetch = function() {
	const func = this.realFetch || (this.isSandbox && this.config.fetch);
	if (!func) {
		throw new Error(
			'fetch-mock: Falling back to network only available on gloabl fetch-mock, or by setting config.fetch on sandboxed fetch-mock'
		);
	}
	return func;
};

FetchMock.push = function({ url, options, request, isUnmatched, identifier }) {
	const args = [url, options];
	args.request = request;
	args.identifier = identifier;
	args.isUnmatched = isUnmatched;
	this._calls.push(args);
};

module.exports = FetchMock;
