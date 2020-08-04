'use strict';

var filter = require('array-filter');
var getData = require('./getData');

module.exports = function byTag(tag) {
	if (typeof tag !== 'string') {
		throw new TypeError('tag must be a string, got ' + typeof tag);
	}
	return filter(getData().elements, function (item) {
		return item.tag === tag;
	});
};
