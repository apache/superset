'use strict';

var mod = require('../helpers/mod');
var msPerSecond = require('../helpers/timeConstants').msPerSecond;

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.10

module.exports = function msFromTime(t) {
	return mod(t, msPerSecond);
};
