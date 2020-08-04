"use strict";

var test = require('tape');
var is = require('./');

test('works with primitives', function (t) {
	t.ok(is(), 'two absent args are the same');
	t.ok(is(undefined), 'undefined & one absent arg are the same');
	t.ok(is(undefined, undefined), 'undefined is undefined');
	t.ok(is(null, null), 'null is null');
	t.ok(is(true, true), 'true is true');
	t.ok(is(false, false), 'false is false');
	t.notOk(is(true, false), 'true is not false');
	t.end();
});

test('works with NaN', function (t) {
	t.ok(is(NaN, NaN), 'NaN is NaN');
	t.end();
});

test('differentiates zeroes', function (t) {
	t.ok(is(0, 0), '+0 is +0');
	t.ok(is(-0, -0), '-0 is -0');
	t.notOk(is(0, -0), '+0 is not -0');
	t.end();
});

test('nonzero numbers', function (t) {
	t.ok(is(Infinity, Infinity), 'infinity is infinity');
	t.ok(is(-Infinity, -Infinity), 'infinity is infinity');
	t.ok(is(42, 42), '42 is 42');
	t.notOk(is(42, -42), '42 is not -42');
	t.end();
});

test('strings', function (t) {
	t.ok(is('', ''), 'empty string is empty string');
	t.ok(is('foo', 'foo'), 'string is string');
	t.notOk(is('foo', 'bar'), 'string is not different string');
	t.end();
});

test('objects', function (t) {
	var obj = {};
	t.ok(is(obj, obj), 'object is same object');
	t.notOk(is(obj, {}), 'object is not different object');
	t.end();
});

