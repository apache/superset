'use strict';

var trimRight = require('../');
trimRight.shim();

var runTests = require('./tests');

var test = require('tape');
var defineProperties = require('define-properties');
var bind = require('function-bind');
var isEnumerable = Object.prototype.propertyIsEnumerable;
var functionsHaveNames = require('functions-have-names')();

test('shimmed', function (t) {
	t.equal(String.prototype.trimRight.length, 0, 'String#trimRight has a length of 0');
	t.test('Function name', { skip: !functionsHaveNames }, function (st) {
		st.equal((/^(?:trimRight|trimEnd)$/).test(String.prototype.trimRight.name), true, 'String#trimRight has name "trimRight" or "trimEnd"');
		st.end();
	});

	t.test('enumerability', { skip: !defineProperties.supportsDescriptors }, function (et) {
		et.equal(false, isEnumerable.call(String.prototype, 'trimRight'), 'String#trimRight is not enumerable');
		et.end();
	});

	var supportsStrictMode = (function () { return typeof this === 'undefined'; }());

	t.test('bad string/this value', { skip: !supportsStrictMode }, function (st) {
		st['throws'](function () { return trimRight(undefined, 'a'); }, TypeError, 'undefined is not an object');
		st['throws'](function () { return trimRight(null, 'a'); }, TypeError, 'null is not an object');
		st.end();
	});

	runTests(bind.call(Function.call, String.prototype.trimRight), t);

	t.end();
});
