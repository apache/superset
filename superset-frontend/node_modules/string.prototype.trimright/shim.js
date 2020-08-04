'use strict';

var define = require('define-properties');
var getPolyfill = require('./polyfill');

module.exports = function shimTrimRight() {
	var polyfill = getPolyfill();
	define(
		String.prototype,
		{ trimRight: polyfill },
		{ trimRight: function () { return String.prototype.trimRight !== polyfill; } }
	);
	return polyfill;
};
