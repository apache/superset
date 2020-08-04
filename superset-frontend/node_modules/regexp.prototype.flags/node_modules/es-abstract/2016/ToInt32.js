'use strict';

var ToNumber = require('./ToNumber');

// http://www.ecma-international.org/ecma-262/5.1/#sec-9.5

module.exports = function ToInt32(x) {
	return ToNumber(x) >> 0;
};
