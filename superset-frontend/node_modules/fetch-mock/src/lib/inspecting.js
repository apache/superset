const { normalizeUrl } = require('./request-utils');
const FetchMock = {};
const { sanitizeRoute } = require('./compile-route');
const generateMatcher = require('./generate-matcher');
const isName = nameOrMatcher =>
	typeof nameOrMatcher === 'string' && /^[\da-zA-Z\-]+$/.test(nameOrMatcher);

const filterCallsWithMatcher = (matcher, options = {}, calls) => {
	matcher = generateMatcher(sanitizeRoute(Object.assign({ matcher }, options)));
	return calls.filter(([url, options]) => matcher(normalizeUrl(url), options));
};

FetchMock.filterCalls = function(nameOrMatcher, options) {
	let calls = this._calls;
	let matcher = '*';

	if (nameOrMatcher === true) {
		calls = calls.filter(({ isUnmatched }) => !isUnmatched);
	} else if (nameOrMatcher === false) {
		calls = calls.filter(({ isUnmatched }) => isUnmatched);
	} else if (typeof nameOrMatcher === 'undefined') {
		calls = calls;
	} else if (isName(nameOrMatcher)) {
		calls = calls.filter(({ identifier }) => identifier === nameOrMatcher);
	} else {
		matcher = normalizeUrl(nameOrMatcher);
		if (this.routes.some(({ identifier }) => identifier === matcher)) {
			calls = calls.filter(call => call.identifier === matcher);
		}
	}

	if ((options || matcher !== '*') && calls.length) {
		if (typeof options === 'string') {
			options = { method: options };
		}
		calls = filterCallsWithMatcher(matcher, options, calls);
	}
	return calls;
};

FetchMock.calls = function(nameOrMatcher, options) {
	return this.filterCalls(nameOrMatcher, options);
};

FetchMock.lastCall = function(nameOrMatcher, options) {
	return [...this.filterCalls(nameOrMatcher, options)].pop();
};

FetchMock.lastUrl = function(nameOrMatcher, options) {
	return (this.lastCall(nameOrMatcher, options) || [])[0];
};

FetchMock.lastOptions = function(nameOrMatcher, options) {
	return (this.lastCall(nameOrMatcher, options) || [])[1];
};

FetchMock.called = function(nameOrMatcher, options) {
	return !!this.filterCalls(nameOrMatcher, options).length;
};

FetchMock.flush = function(waitForResponseMethods) {
	const queuedPromises = this._holdingPromises;
	this._holdingPromises = [];

	return Promise.all(queuedPromises).then(() => {
		if (waitForResponseMethods && this._holdingPromises.length) {
			return this.flush(waitForResponseMethods);
		}
	});
};

FetchMock.done = function(nameOrMatcher) {
	const routesToCheck =
		nameOrMatcher && typeof nameOrMatcher !== 'boolean'
			? [{ identifier: nameOrMatcher }]
			: this.routes;

	// Can't use array.every because would exit after first failure, which would
	// break the logging
	return routesToCheck
		.map(({ identifier }) => {
			if (!this.called(identifier)) {
				console.warn(`Warning: ${identifier} not called`); // eslint-disable-line
				return false;
			}

			const expectedTimes = (
				this.routes.find(r => r.identifier === identifier) || {}
			).repeat;

			if (!expectedTimes) {
				return true;
			}
			const actualTimes = this.filterCalls(identifier).length;
			if (expectedTimes > actualTimes) {
				console.warn(
					`Warning: ${identifier} only called ${actualTimes} times, but ${expectedTimes} expected`
				); // eslint-disable-line
				return false;
			} else {
				return true;
			}
		})
		.every(isDone => isDone);
};

module.exports = FetchMock;
