'use strict';

var test = require('tape');
var isArray = require('isarray');

var byTag = require('../byTag');

test('byTag()', function (t) {
	t.equal(typeof byTag, 'function', 'is a function');

	t['throws'](function () { byTag(); }, 'requires a string');

	var items = byTag('a');

	t.equal(isArray(items), true, 'returns an array');

	t.deepEqual(items, [{
		constructor: global.HTMLAnchorElement,
		constructorName: 'HTMLAnchorElement',
		expectedConstructor: global.HTMLAnchorElement,
		tag: 'a'
	}], 'has expected data');

	t.end();
});
