'use strict';

var test = require('tape');

var main = require('../');
var byTag = require('../byTag');
var byConstructor = require('../byConstructor');
var byConstructorName = require('../byConstructorName');

test('main', function (t) {
	t.deepEqual(main, {
		byConstructor: byConstructor,
		byConstructorName: byConstructorName,
		byTag: byTag
	}, 'main has expected exports');

	t.end();
});

require('./getData');

require('./byTag');

require('./byConstructor');

require('./byConstructorName');
