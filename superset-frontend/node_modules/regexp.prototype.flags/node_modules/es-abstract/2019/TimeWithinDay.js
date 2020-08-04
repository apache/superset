'use strict';

var mod = require('../helpers/mod');
var msPerDay = require('../helpers/timeConstants').msPerDay;

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.2

module.exports = function TimeWithinDay(t) {
	return mod(t, msPerDay);
};

