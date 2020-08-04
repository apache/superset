'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var test = require('tape');
var forEach = require('foreach');
var debug = require('object-inspect');

var v = require('./helpers/values');

test('export', function (t) {
	t.equal(typeof GetIntrinsic, 'function', 'it is a function');
	t.equal(GetIntrinsic.length, 2, 'function has length of 2');

	t.end();
});

test('throws', function (t) {
	t['throws'](
		function () { GetIntrinsic('not an intrinsic'); },
		SyntaxError,
		'nonexistent intrinsic throws a syntax error'
	);

	t['throws'](
		function () { GetIntrinsic(''); },
		TypeError,
		'empty string intrinsic throws a type error'
	);

	t['throws'](
		function () { GetIntrinsic('.'); },
		SyntaxError,
		'"just a dot" intrinsic throws a syntax error'
	);

	forEach(v.nonStrings, function (nonString) {
		t['throws'](
			function () { GetIntrinsic(nonString); },
			TypeError,
			debug(nonString) + ' is not a String'
		);
	});

	forEach(v.nonBooleans, function (nonBoolean) {
		t['throws'](
			function () { GetIntrinsic('%', nonBoolean); },
			TypeError,
			debug(nonBoolean) + ' is not a Boolean'
		);
	});

	forEach([
		'toString',
		'propertyIsEnumerable',
		'hasOwnProperty'
	], function (objectProtoMember) {
		t['throws'](
			function () { GetIntrinsic(objectProtoMember); },
			SyntaxError,
			debug(objectProtoMember) + ' is not an intrinsic'
		);
	});

	t.end();
});

test('base intrinsics', function (t) {
	t.equal(GetIntrinsic('%Object%'), Object, '%Object% yields Object');
	t.equal(GetIntrinsic('Object'), Object, 'Object yields Object');
	t.equal(GetIntrinsic('%Array%'), Array, '%Array% yields Array');
	t.equal(GetIntrinsic('Array'), Array, 'Array yields Array');

	t.end();
});

test('dotted paths', function (t) {
	t.equal(GetIntrinsic('%Object.prototype.toString%'), Object.prototype.toString, '%Object.prototype.toString% yields Object.prototype.toString');
	t.equal(GetIntrinsic('Object.prototype.toString'), Object.prototype.toString, 'Object.prototype.toString yields Object.prototype.toString');
	t.equal(GetIntrinsic('%Array.prototype.push%'), Array.prototype.push, '%Array.prototype.push% yields Array.prototype.push');
	t.equal(GetIntrinsic('Array.prototype.push'), Array.prototype.push, 'Array.prototype.push yields Array.prototype.push');

	t.end();
});

test('accessors', { skip: !Object.getOwnPropertyDescriptor || typeof Map !== 'function' }, function (t) {
	var actual = Object.getOwnPropertyDescriptor(Map.prototype, 'size');
	t.ok(actual, 'Map.prototype.size has a descriptor');
	t.equal(typeof actual.get, 'function', 'Map.prototype.size has a getter function');
	t.equal(GetIntrinsic('%Map.prototype.size%'), actual.get, '%Map.prototype.size% yields the getter for it');
	t.equal(GetIntrinsic('Map.prototype.size'), actual.get, 'Map.prototype.size yields the getter for it');

	t.end();
});
