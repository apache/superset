const responseConfigProps = [
	'body',
	'headers',
	'throws',
	'status',
	'redirectUrl'
];

class ResponseBuilder {
	constructor(options) {
		Object.assign(this, options);
	}

	exec() {
		this.normalizeResponseConfig();
		this.constructFetchOpts();
		this.constructResponseBody();
		return this.buildObservableResponse(
			new this.fetchMock.config.Response(this.body, this.options)
		);
	}

	sendAsObject() {
		if (responseConfigProps.some(prop => this.responseConfig[prop])) {
			if (
				Object.keys(this.responseConfig).every(key =>
					responseConfigProps.includes(key)
				)
			) {
				return false;
			} else {
				return true;
			}
		} else {
			return true;
		}
	}

	normalizeResponseConfig() {
		// If the response config looks like a status, start to generate a simple response
		if (typeof this.responseConfig === 'number') {
			this.responseConfig = {
				status: this.responseConfig
			};
			// If the response config is not an object, or is an object that doesn't use
			// any reserved properties, assume it is meant to be the body of the response
		} else if (typeof this.responseConfig === 'string' || this.sendAsObject()) {
			this.responseConfig = {
				body: this.responseConfig
			};
		}
	}

	validateStatus(status) {
		if (!status) {
			return 200;
		}

		if (
			(typeof status === 'number' &&
				parseInt(status, 10) !== status &&
				status >= 200) ||
			status < 600
		) {
			return status;
		}

		throw new TypeError(`fetch-mock: Invalid status ${status} passed on response object.
To respond with a JSON object that has status as a property assign the object to body
e.g. {"body": {"status: "registered"}}`);
	}

	constructFetchOpts() {
		this.options = this.responseConfig.options || {};
		this.options.url = this.responseConfig.redirectUrl || this.url;
		this.options.status = this.validateStatus(this.responseConfig.status);
		this.options.statusText = this.fetchMock.statusTextMap[
			'' + this.options.status
		];
		// Set up response headers. The empty object is to cope with
		// new Headers(undefined) throwing in Chrome
		// https://code.google.com/p/chromium/issues/detail?id=335871
		this.options.headers = new this.fetchMock.config.Headers(
			this.responseConfig.headers || {}
		);
	}

	getOption(name) {
		return name in this.route ? this.route[name] : this.fetchMock.config[name];
	}

	convertToJson() {
		// convert to json if we need to
		if (
			this.getOption('sendAsJson') &&
			this.responseConfig.body != null && //eslint-disable-line
			typeof this.body === 'object'
		) {
			this.body = JSON.stringify(this.body);
			if (!this.options.headers.has('Content-Type')) {
				this.options.headers.set('Content-Type', 'application/json');
			}
		}
	}

	setContentLength() {
		// add a Content-Length header if we need to
		if (
			this.getOption('includeContentLength') &&
			typeof this.body === 'string' &&
			!this.options.headers.has('Content-Length')
		) {
			this.options.headers.set('Content-Length', this.body.length.toString());
		}
	}

	constructResponseBody() {
		// start to construct the body
		this.body = this.responseConfig.body;
		this.convertToJson();
		this.setContentLength();

		// On the server we need to manually construct the readable stream for the
		// Response object (on the client this done automatically)
		if (this.Stream) {
			const stream = new this.Stream.Readable();
			if (this.body != null) { //eslint-disable-line
				stream.push(this.body, 'utf-8');
			}
			stream.push(null);
			this.body = stream;
		}
		this.body = this.body;
	}

	buildObservableResponse(response) {
		const fetchMock = this.fetchMock;

		// Using a proxy means we can set properties that may not be writable on
		// the original Response. It also means we can track the resolution of
		// promises returned by res.json(), res.text() etc
		return new Proxy(response, {
			get: (originalResponse, name) => {
				if (this.responseConfig.redirectUrl) {
					if (name === 'url') {
						return this.responseConfig.redirectUrl;
					}

					if (name === 'redirected') {
						return true;
					}
				}

				if (typeof originalResponse[name] === 'function') {
					return new Proxy(originalResponse[name], {
						apply: (func, thisArg, args) => {
							const result = func.apply(response, args);
							if (result.then) {
								fetchMock._holdingPromises.push(result.catch(() => null));
							}
							return result;
						}
					});
				}

				return originalResponse[name];
			}
		});
	}
}

module.exports = options => new ResponseBuilder(options).exec();
