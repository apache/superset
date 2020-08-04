'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $floor = GetIntrinsic('%Math.floor%');

var mod = require('../helpers/mod');
var timeConstants = require('../helpers/timeConstants');
var msPerMinute = timeConstants.msPerMinute;
var MinutesPerHour = timeConstants.MinutesPerHour;

// https://ecma-international.org/ecma-262/5.1/#sec-15.9.1.10

module.exports = function MinFromTime(t) {
	return mod($floor(t / msPerMinute), MinutesPerHour);
};
