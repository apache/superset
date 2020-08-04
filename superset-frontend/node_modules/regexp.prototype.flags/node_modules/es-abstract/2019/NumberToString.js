'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $String = GetIntrinsic('%String%');

var Type = require('./Type');

// https://www.ecma-international.org/ecma-262/9.0/#sec-tostring-applied-to-the-number-type

module.exports = function NumberToString(m) {
	if (Type(m) !== 'Number') {
		throw new TypeError('Assertion failed: "m" must be a String');
	}

	return $String(m);
};

