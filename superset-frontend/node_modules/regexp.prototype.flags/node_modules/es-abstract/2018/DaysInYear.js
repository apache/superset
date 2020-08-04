'use strict';

var mod = require('../helpers/mod');

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.3

module.exports = function DaysInYear(y) {
	if (mod(y, 4) !== 0) {
		return 365;
	}
	if (mod(y, 100) !== 0) {
		return 366;
	}
	if (mod(y, 400) !== 0) {
		return 365;
	}
	return 366;
};
