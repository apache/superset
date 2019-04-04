const URL = require('whatwg-url');
// https://stackoverflow.com/a/19709846/308237
const absoluteUrlRX = new RegExp('^(?:[a-z]+:)?//', 'i');

const headersToArray = headers => {
	// node-fetch 1 Headers
	if (typeof headers.raw === 'function') {
		return Object.entries(headers.raw());
	} else if (headers[Symbol.iterator]) {
		return [...headers];
	} else {
		return Object.entries(headers);
	}
};

const zipObject = entries =>
	entries.reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {});

const normalizeUrl = url => {
	if (
		typeof url === 'function' ||
		url instanceof RegExp ||
		/^(begin|end|glob|express|path)\:/.test(url)
	) {
		return url;
	}
	if (absoluteUrlRX.test(url)) {
		const u = new URL.URL(url);
		return u.href;
	} else {
		const u = new URL.URL(url, 'http://dummy');
		return u.pathname + u.search;
	}
};

module.exports = {
	normalizeRequest: (url, options, Request) => {
		if (Request.prototype.isPrototypeOf(url)) {
			const obj = {
				url: normalizeUrl(url.url),
				options: {
					method: url.method
				},
				request: url
			};

			const headers = headersToArray(url.headers);

			if (headers.length) {
				obj.options.headers = zipObject(headers);
			}
			return obj;
		} else if (
			typeof url === 'string' ||
			// horrible URL object duck-typing
			(typeof url === 'object' && 'href' in url)
		) {
			return {
				url: normalizeUrl(url),
				options: options
			};
		} else if (typeof url === 'object') {
			throw new TypeError(
				'fetch-mock: Unrecognised Request object. Read the Config and Installation sections of the docs'
			);
		} else {
			throw new TypeError('fetch-mock: Invalid arguments passed to fetch');
		}
	},
	normalizeUrl,
	getPath: url => {
		const u = absoluteUrlRX.test(url)
			? new URL.URL(url)
			: new URL.URL(url, 'http://dummy');
		return u.pathname;
	},

	getQuery: url => {
		const u = absoluteUrlRX.test(url)
			? new URL.URL(url)
			: new URL.URL(url, 'http://dummy');
		return u.search ? u.search.substr(1) : '';
	},
	headers: {
		normalize: headers => zipObject(headersToArray(headers)),
		toLowerCase: headers =>
			Object.keys(headers).reduce((obj, k) => {
				obj[k.toLowerCase()] = headers[k];
				return obj;
			}, {}),
		equal: (actualHeader, expectedHeader) => {
			actualHeader = Array.isArray(actualHeader)
				? actualHeader
				: [actualHeader];
			expectedHeader = Array.isArray(expectedHeader)
				? expectedHeader
				: [expectedHeader];

			if (actualHeader.length !== expectedHeader.length) {
				return false;
			}

			return actualHeader.every((val, i) => val === expectedHeader[i]);
		}
	}
};
