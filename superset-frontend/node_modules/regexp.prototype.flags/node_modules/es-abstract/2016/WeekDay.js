'use strict';

var mod = require('../helpers/mod');

var Day = require('./Day');

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.6

module.exports = function WeekDay(t) {
	return mod(Day(t) + 4, 7);
};
