'use strict';

var test = require('tape');
var isBoolean = require('./');
var hasSymbols = typeof Symbol === 'function' && typeof Symbol() === 'symbol';

test('not Booleans', function (t) {
	t.notOk(isBoolean(), 'undefined is not Boolean');
	t.notOk(isBoolean(null), 'null is not Boolean');
	t.notOk(isBoolean(0), '0 is not Boolean');
	t.notOk(isBoolean(Object(42)), 'number object is not Boolean');
	t.notOk(isBoolean(NaN), 'NaN is not Boolean');
	t.notOk(isBoolean(Infinity), 'Infinity is not Boolean');
	t.notOk(isBoolean('foo'), 'string is not Boolean');
	t.notOk(isBoolean([]), 'array is not Boolean');
	t.notOk(isBoolean({}), 'object is not Boolean');
	t.notOk(isBoolean(function () {}), 'function is not Boolean');
	t.notOk(isBoolean(/a/g), 'regex literal is not Boolean');
	t.notOk(isBoolean(new RegExp('a', 'g')), 'regex object is not Boolean');
	t.notOk(isBoolean(new Date()), 'new Date() is not Boolean');
	t.end();
});

test('@@toStringTag', { skip: !hasSymbols || !Symbol.toStringTag }, function (t) {
	var fakeBoolean = { valueOf: function () { return true; }, toString: function () { return 'true'; } };
	fakeBoolean[Symbol.toStringTag] = 'Boolean';
	t.notOk(isBoolean(fakeBoolean), 'fake Boolean with @@toStringTag "Boolean" is not Boolean');
	t.end();
});

test('Booleans', function (t) {
	t.ok(isBoolean(true), 'true is Boolean');
	t.ok(isBoolean(false), 'false is Boolean');
	t.ok(isBoolean(Object(true)), 'Object(true) is Boolean');
	t.ok(isBoolean(Object(false)), 'Object(false) is Boolean');
	t.end();
});
