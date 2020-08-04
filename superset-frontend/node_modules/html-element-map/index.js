'use strict';

var byTag = require('./byTag');
var byConstructor = require('./byConstructor');
var byConstructorName = require('./byConstructorName');

module.exports = {
	byConstructor: byConstructor,
	byConstructorName: byConstructorName,
	byTag: byTag
};
