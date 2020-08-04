'use strict';

var test = require('tape');
var isArray = require('isarray');

var byConstructor = require('../byConstructor');
var getData = require('../getData');

test('byConstructor()', function (t) {
	t.equal(typeof byConstructor, 'function', 'is a function');

	t.test('with an actual constructor', { skip: typeof HTMLDivElement === 'undefined' }, function (st) {
		var items = byConstructor(HTMLDivElement);

		st.equal(isArray(items), true, 'returns an array');

		st.deepEqual(items, [{
			constructor: global.HTMLDivElement,
			constructorName: 'HTMLDivElement',
			expectedConstructor: global.HTMLDivElement,
			tag: 'div'
		}], 'has expected data');

		st.end();
	});

	t.test('with the base constructor', { skip: typeof HTMLElement === 'undefined' }, function (st) {
		var items = byConstructor(HTMLElement);
		var data = getData();
		st.deepEqual(items, data.elements, 'HTMLElement yields all elements');

		st.end();
	});

	t.end();
});
