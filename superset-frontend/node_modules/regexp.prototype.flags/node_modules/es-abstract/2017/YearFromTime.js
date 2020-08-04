'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $Date = GetIntrinsic('%Date%');

var callBound = require('../helpers/callBound');

var $getUTCFullYear = callBound('Date.prototype.getUTCFullYear');

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.3

module.exports = function YearFromTime(t) {
	// largest y such that this.TimeFromYear(y) <= t
	return $getUTCFullYear(new $Date(t));
};
