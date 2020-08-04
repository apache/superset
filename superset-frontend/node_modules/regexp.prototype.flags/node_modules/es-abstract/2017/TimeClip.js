'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $Date = GetIntrinsic('%Date%');
var $Number = GetIntrinsic('%Number%');
var $abs = GetIntrinsic('%Math.abs%');

var $isFinite = require('../helpers/isFinite');

var ToNumber = require('./ToNumber');

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.14

module.exports = function TimeClip(time) {
	if (!$isFinite(time) || $abs(time) > 8.64e15) {
		return NaN;
	}
	return $Number(new $Date(ToNumber(time)));
};

