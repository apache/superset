'use strict';

var trimLeft = require('../');
trimLeft.shim();

var runTests = require('./tests');

var test = require('tape');
var defineProperties = require('define-properties');
var bind = require('function-bind');
var isEnumerable = Object.prototype.propertyIsEnumerable;
var functionsHaveNames = require('functions-have-names')();

test('shimmed', function (t) {
	t.equal(String.prototype.trimLeft.length, 0, 'String#trimLeft has a length of 0');
	t.test('Function name', { skip: !functionsHaveNames }, function (st) {
		st.equal((/^(?:trimLeft|trimStart)$/).test(String.prototype.trimLeft.name), true, 'String#trimLeft has name "trimLeft" or "trimStart"');
		st.end();
	});

	t.test('enumerability', { skip: !defineProperties.supportsDescriptors }, function (et) {
		et.equal(false, isEnumerable.call(String.prototype, 'trimLeft'), 'String#trimLeft is not enumerable');
		et.end();
	});

	var supportsStrictMode = (function () { return typeof this === 'undefined'; }());

	t.test('bad string/this value', { skip: !supportsStrictMode }, function (st) {
		st['throws'](function () { return trimLeft(undefined, 'a'); }, TypeError, 'undefined is not an object');
		st['throws'](function () { return trimLeft(null, 'a'); }, TypeError, 'null is not an object');
		st.end();
	});

	runTests(bind.call(Function.call, String.prototype.trimLeft), t);

	t.end();
});
