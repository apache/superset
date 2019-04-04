'use strict';
const {toString} = Object.prototype;

module.exports = fn => {
	if (typeof fn !== 'function') {
		return false;
	}

	return (fn.constructor && fn.constructor.name === 'GeneratorFunction') ||
		toString.call(fn) === '[object GeneratorFunction]';
};

module.exports.default = module.exports;
