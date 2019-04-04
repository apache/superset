'use strict';

const isPromise = input => (
	input instanceof Promise ||
	(
		input !== null &&
		typeof input === 'object' &&
		typeof input.then === 'function' &&
		typeof input.catch === 'function'
	)
);

module.exports = isPromise;
module.exports.default = isPromise;
