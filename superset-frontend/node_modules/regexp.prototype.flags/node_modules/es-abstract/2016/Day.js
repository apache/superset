'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $floor = GetIntrinsic('%Math.floor%');

var msPerDay = require('../helpers/timeConstants').msPerDay;

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.2

module.exports = function Day(t) {
	return $floor(t / msPerDay);
};
