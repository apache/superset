'use strict';

var filter = require('array-filter');
var getData = require('./getData');

module.exports = function byConstructor(constructor) {
	if (!constructor) {
		return [];
	}

	var data = getData();
	if (constructor === data.unknown) {
		return [];
	}
	if (constructor === data.all) {
		return data.elements;
	}
	return filter(data.elements, function (item) {
		return item.constructor === constructor;
	});
};
