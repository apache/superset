'use strict';

var test = require('tape');
var isArray = require('isarray');

var byConstructorName = require('../byConstructorName');
var getData = require('../getData');

test('byConstructorName()', function (t) {
	t.equal(typeof byConstructorName, 'function', 'is a function');

	t['throws'](function () { byConstructorName(); }, 'requires a constructor name');

	t.test('with an actual constructor name', function (st) {
		var items = byConstructorName('HTMLDivElement');

		st.equal(isArray(items), true, 'returns an array');

		st.deepEqual(items, [{
			constructor: global.HTMLDivElement,
			constructorName: 'HTMLDivElement',
			expectedConstructor: global.HTMLDivElement,
			tag: 'div'
		}], 'has expected data');

		st.end();
	});

	t.test('with the base constructor name', function (st) {
		var items = byConstructorName('HTMLElement');
		var data = getData();
		st.deepEqual(items, data.elements, 'HTMLElement yields all elements');

		st.end();
	});

	t.end();
});
