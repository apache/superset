'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $String = GetIntrinsic('%String%');

// http://www.ecma-international.org/ecma-262/5.1/#sec-9.8

module.exports = function ToString(value) {
	return $String(value);
};

