'use strict';

var filter = require('array-filter');
var getData = require('./getData');

module.exports = function byConstructorName(constructorName) {
	if (typeof constructorName !== 'string') {
		throw new TypeError('constructorName must be a string, got ' + typeof constructorName);
	}
	var data = getData();
	if (constructorName === 'HTMLElement') {
		return data.elements;
	}
	return filter(data.elements, function (item) {
		return item.constructorName === constructorName;
	});
};
