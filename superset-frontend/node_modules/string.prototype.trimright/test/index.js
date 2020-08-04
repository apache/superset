'use strict';

var trimRight = require('../');
var test = require('tape');
var runTests = require('./tests');

test('as a function', function (t) {
	t.test('bad array/this value', function (st) {
		st['throws'](function () { trimRight(undefined, 'a'); }, TypeError, 'undefined is not an object');
		st['throws'](function () { trimRight(null, 'a'); }, TypeError, 'null is not an object');
		st.end();
	});

	runTests(trimRight, t);

	t.end();
});
