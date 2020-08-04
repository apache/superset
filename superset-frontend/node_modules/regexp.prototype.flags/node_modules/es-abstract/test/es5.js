'use strict';

var ES = require('../').ES5;
var test = require('tape');

var forEach = require('foreach');
var is = require('object-is');
var debug = require('object-inspect');

var v = require('./helpers/values');

require('./helpers/runManifestTest')(test, ES, 5);

test('ToPrimitive', function (t) {
	t.test('primitives', function (st) {
		var testPrimitive = function (primitive) {
			st.ok(is(ES.ToPrimitive(primitive), primitive), debug(primitive) + ' is returned correctly');
		};
		forEach(v.primitives, testPrimitive);
		st.end();
	});

	t.test('objects', function (st) {
		st.equal(ES.ToPrimitive(v.coercibleObject), v.coercibleObject.valueOf(), 'coercibleObject coerces to valueOf');
		st.equal(ES.ToPrimitive(v.coercibleObject, Number), v.coercibleObject.valueOf(), 'coercibleObject with hint Number coerces to valueOf');
		st.equal(ES.ToPrimitive(v.coercibleObject, String), v.coercibleObject.toString(), 'coercibleObject with hint String coerces to toString');
		st.equal(ES.ToPrimitive(v.coercibleFnObject), v.coercibleFnObject.toString(), 'coercibleFnObject coerces to toString');
		st.equal(ES.ToPrimitive(v.toStringOnlyObject), v.toStringOnlyObject.toString(), 'toStringOnlyObject returns toString');
		st.equal(ES.ToPrimitive(v.valueOfOnlyObject), v.valueOfOnlyObject.valueOf(), 'valueOfOnlyObject returns valueOf');
		st.equal(ES.ToPrimitive({}), '[object Object]', '{} with no hint coerces to Object#toString');
		st.equal(ES.ToPrimitive({}, String), '[object Object]', '{} with hint String coerces to Object#toString');
		st.equal(ES.ToPrimitive({}, Number), '[object Object]', '{} with hint Number coerces to Object#toString');
		st['throws'](function () { return ES.ToPrimitive(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws a TypeError');
		st['throws'](function () { return ES.ToPrimitive(v.uncoercibleFnObject); }, TypeError, 'uncoercibleFnObject throws a TypeError');
		st.end();
	});

	t.end();
});

test('ToBoolean', function (t) {
	t.equal(false, ES.ToBoolean(undefined), 'undefined coerces to false');
	t.equal(false, ES.ToBoolean(null), 'null coerces to false');
	t.equal(false, ES.ToBoolean(false), 'false returns false');
	t.equal(true, ES.ToBoolean(true), 'true returns true');
	forEach([0, -0, NaN], function (falsyNumber) {
		t.equal(false, ES.ToBoolean(falsyNumber), 'falsy number ' + falsyNumber + ' coerces to false');
	});
	forEach([Infinity, 42, 1, -Infinity], function (truthyNumber) {
		t.equal(true, ES.ToBoolean(truthyNumber), 'truthy number ' + truthyNumber + ' coerces to true');
	});
	t.equal(false, ES.ToBoolean(''), 'empty string coerces to false');
	t.equal(true, ES.ToBoolean('foo'), 'nonempty string coerces to true');
	forEach(v.objects, function (obj) {
		t.equal(true, ES.ToBoolean(obj), 'object coerces to true');
	});
	t.equal(true, ES.ToBoolean(v.uncoercibleObject), 'uncoercibleObject coerces to true');
	t.end();
});

test('ToNumber', function (t) {
	t.ok(is(NaN, ES.ToNumber(undefined)), 'undefined coerces to NaN');
	t.ok(is(ES.ToNumber(null), 0), 'null coerces to +0');
	t.ok(is(ES.ToNumber(false), 0), 'false coerces to +0');
	t.equal(1, ES.ToNumber(true), 'true coerces to 1');
	t.ok(is(NaN, ES.ToNumber(NaN)), 'NaN returns itself');
	forEach([0, -0, 42, Infinity, -Infinity], function (num) {
		t.equal(num, ES.ToNumber(num), num + ' returns itself');
	});
	forEach(['foo', '0', '4a', '2.0', 'Infinity', '-Infinity'], function (numString) {
		t.ok(is(+numString, ES.ToNumber(numString)), '"' + numString + '" coerces to ' + Number(numString));
	});
	forEach(v.objects, function (object) {
		t.ok(is(ES.ToNumber(object), ES.ToNumber(ES.ToPrimitive(object))), 'object ' + object + ' coerces to same as ToPrimitive of object does');
	});
	t['throws'](function () { return ES.ToNumber(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.end();
});

test('ToInteger', function (t) {
	t.ok(is(0, ES.ToInteger(NaN)), 'NaN coerces to +0');
	forEach([0, Infinity, 42], function (num) {
		t.ok(is(num, ES.ToInteger(num)), num + ' returns itself');
		t.ok(is(-num, ES.ToInteger(-num)), '-' + num + ' returns itself');
	});
	t.equal(3, ES.ToInteger(Math.PI), 'pi returns 3');
	t['throws'](function () { return ES.ToInteger(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.end();
});

test('ToInt32', function (t) {
	t.ok(is(0, ES.ToInt32(NaN)), 'NaN coerces to +0');
	forEach([0, Infinity], function (num) {
		t.ok(is(0, ES.ToInt32(num)), num + ' returns +0');
		t.ok(is(0, ES.ToInt32(-num)), '-' + num + ' returns +0');
	});
	t['throws'](function () { return ES.ToInt32(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.ok(is(ES.ToInt32(0x100000000), 0), '2^32 returns +0');
	t.ok(is(ES.ToInt32(0x100000000 - 1), -1), '2^32 - 1 returns -1');
	t.ok(is(ES.ToInt32(0x80000000), -0x80000000), '2^31 returns -2^31');
	t.ok(is(ES.ToInt32(0x80000000 - 1), 0x80000000 - 1), '2^31 - 1 returns 2^31 - 1');
	forEach([0, Infinity, NaN, 0x100000000, 0x80000000, 0x10000, 0x42], function (num) {
		t.ok(is(ES.ToInt32(num), ES.ToInt32(ES.ToUint32(num))), 'ToInt32(x) === ToInt32(ToUint32(x)) for 0x' + num.toString(16));
		t.ok(is(ES.ToInt32(-num), ES.ToInt32(ES.ToUint32(-num))), 'ToInt32(x) === ToInt32(ToUint32(x)) for -0x' + num.toString(16));
	});
	t.end();
});

test('ToUint32', function (t) {
	t.ok(is(0, ES.ToUint32(NaN)), 'NaN coerces to +0');
	forEach([0, Infinity], function (num) {
		t.ok(is(0, ES.ToUint32(num)), num + ' returns +0');
		t.ok(is(0, ES.ToUint32(-num)), '-' + num + ' returns +0');
	});
	t['throws'](function () { return ES.ToUint32(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.ok(is(ES.ToUint32(0x100000000), 0), '2^32 returns +0');
	t.ok(is(ES.ToUint32(0x100000000 - 1), 0x100000000 - 1), '2^32 - 1 returns 2^32 - 1');
	t.ok(is(ES.ToUint32(0x80000000), 0x80000000), '2^31 returns 2^31');
	t.ok(is(ES.ToUint32(0x80000000 - 1), 0x80000000 - 1), '2^31 - 1 returns 2^31 - 1');
	forEach([0, Infinity, NaN, 0x100000000, 0x80000000, 0x10000, 0x42], function (num) {
		t.ok(is(ES.ToUint32(num), ES.ToUint32(ES.ToInt32(num))), 'ToUint32(x) === ToUint32(ToInt32(x)) for 0x' + num.toString(16));
		t.ok(is(ES.ToUint32(-num), ES.ToUint32(ES.ToInt32(-num))), 'ToUint32(x) === ToUint32(ToInt32(x)) for -0x' + num.toString(16));
	});
	t.end();
});

test('ToUint16', function (t) {
	t.ok(is(0, ES.ToUint16(NaN)), 'NaN coerces to +0');
	forEach([0, Infinity], function (num) {
		t.ok(is(0, ES.ToUint16(num)), num + ' returns +0');
		t.ok(is(0, ES.ToUint16(-num)), '-' + num + ' returns +0');
	});
	t['throws'](function () { return ES.ToUint16(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.ok(is(ES.ToUint16(0x100000000), 0), '2^32 returns +0');
	t.ok(is(ES.ToUint16(0x100000000 - 1), 0x10000 - 1), '2^32 - 1 returns 2^16 - 1');
	t.ok(is(ES.ToUint16(0x80000000), 0), '2^31 returns +0');
	t.ok(is(ES.ToUint16(0x80000000 - 1), 0x10000 - 1), '2^31 - 1 returns 2^16 - 1');
	t.ok(is(ES.ToUint16(0x10000), 0), '2^16 returns +0');
	t.ok(is(ES.ToUint16(0x10000 - 1), 0x10000 - 1), '2^16 - 1 returns 2^16 - 1');
	t.end();
});

test('ToString', function (t) {
	t['throws'](function () { return ES.ToString(v.uncoercibleObject); }, TypeError, 'uncoercibleObject throws');
	t.end();
});

test('ToObject', function (t) {
	t['throws'](function () { return ES.ToObject(undefined); }, TypeError, 'undefined throws');
	t['throws'](function () { return ES.ToObject(null); }, TypeError, 'null throws');
	forEach(v.numbers, function (number) {
		var obj = ES.ToObject(number);
		t.equal(typeof obj, 'object', 'number ' + number + ' coerces to object');
		t.equal(true, obj instanceof Number, 'object of ' + number + ' is Number object');
		t.ok(is(obj.valueOf(), number), 'object of ' + number + ' coerces to ' + number);
	});
	t.end();
});

test('CheckObjectCoercible', function (t) {
	t['throws'](function () { return ES.CheckObjectCoercible(undefined); }, TypeError, 'undefined throws');
	t['throws'](function () { return ES.CheckObjectCoercible(null); }, TypeError, 'null throws');
	var checkCoercible = function (value) {
		t.doesNotThrow(function () { return ES.CheckObjectCoercible(value); }, debug(value) + ' does not throw');
	};
	forEach(v.objects.concat(v.nonNullPrimitives), checkCoercible);
	t.end();
});

test('IsCallable', function (t) {
	t.equal(true, ES.IsCallable(function () {}), 'function is callable');
	var nonCallables = [/a/g, {}, Object.prototype, NaN].concat(v.primitives);
	forEach(nonCallables, function (nonCallable) {
		t.equal(false, ES.IsCallable(nonCallable), debug(nonCallable) + ' is not callable');
	});
	t.end();
});

test('SameValue', function (t) {
	t.equal(true, ES.SameValue(NaN, NaN), 'NaN is SameValue as NaN');
	t.equal(false, ES.SameValue(0, -0), '+0 is not SameValue as -0');
	forEach(v.objects.concat(v.primitives), function (val) {
		t.equal(val === val, ES.SameValue(val, val), debug(val) + ' is SameValue to itself');
	});
	t.end();
});

test('Type', function (t) {
	t.equal(ES.Type(), 'Undefined', 'Type() is Undefined');
	t.equal(ES.Type(undefined), 'Undefined', 'Type(undefined) is Undefined');
	t.equal(ES.Type(null), 'Null', 'Type(null) is Null');
	t.equal(ES.Type(true), 'Boolean', 'Type(true) is Boolean');
	t.equal(ES.Type(false), 'Boolean', 'Type(false) is Boolean');
	t.equal(ES.Type(0), 'Number', 'Type(0) is Number');
	t.equal(ES.Type(NaN), 'Number', 'Type(NaN) is Number');
	t.equal(ES.Type('abc'), 'String', 'Type("abc") is String');
	t.equal(ES.Type(function () {}), 'Object', 'Type(function () {}) is Object');
	t.equal(ES.Type({}), 'Object', 'Type({}) is Object');
	t.end();
});

test('IsPropertyDescriptor', function (t) {
	forEach(v.primitives, function (primitive) {
		t.equal(ES.IsPropertyDescriptor(primitive), false, debug(primitive) + ' is not a Property Descriptor');
	});

	t.equal(ES.IsPropertyDescriptor({ invalid: true }), false, 'invalid keys not allowed on a Property Descriptor');

	t.equal(ES.IsPropertyDescriptor({}), true, 'empty object is an incomplete Property Descriptor');

	t.equal(ES.IsPropertyDescriptor(v.accessorDescriptor()), true, 'accessor descriptor is a Property Descriptor');
	t.equal(ES.IsPropertyDescriptor(v.mutatorDescriptor()), true, 'mutator descriptor is a Property Descriptor');
	t.equal(ES.IsPropertyDescriptor(v.dataDescriptor()), true, 'data descriptor is a Property Descriptor');
	t.equal(ES.IsPropertyDescriptor(v.genericDescriptor()), true, 'generic descriptor is a Property Descriptor');

	t['throws'](
		function () { ES.IsPropertyDescriptor(v.bothDescriptor()); },
		TypeError,
		'a Property Descriptor can not be both a Data and an Accessor Descriptor'
	);

	t['throws'](
		function () { ES.IsPropertyDescriptor(v.bothDescriptorWritable()); },
		TypeError,
		'a Property Descriptor can not be both a Data and an Accessor Descriptor'
	);

	t.end();
});

test('IsAccessorDescriptor', function (t) {
	forEach(v.nonNullPrimitives.concat(null), function (primitive) {
		t['throws'](function () { ES.IsAccessorDescriptor(primitive); }, TypeError, debug(primitive) + ' is not a Property Descriptor');
	});

	t.equal(ES.IsAccessorDescriptor(), false, 'no value is not an Accessor Descriptor');
	t.equal(ES.IsAccessorDescriptor(undefined), false, 'undefined value is not an Accessor Descriptor');

	t.equal(ES.IsAccessorDescriptor(v.accessorDescriptor()), true, 'accessor descriptor is an Accessor Descriptor');
	t.equal(ES.IsAccessorDescriptor(v.mutatorDescriptor()), true, 'mutator descriptor is an Accessor Descriptor');
	t.equal(ES.IsAccessorDescriptor(v.dataDescriptor()), false, 'data descriptor is not an Accessor Descriptor');
	t.equal(ES.IsAccessorDescriptor(v.genericDescriptor()), false, 'generic descriptor is not an Accessor Descriptor');

	t.end();
});

test('IsDataDescriptor', function (t) {
	forEach(v.nonNullPrimitives.concat(null), function (primitive) {
		t['throws'](function () { ES.IsDataDescriptor(primitive); }, TypeError, debug(primitive) + ' is not a Property Descriptor');
	});

	t.equal(ES.IsDataDescriptor(), false, 'no value is not a Data Descriptor');
	t.equal(ES.IsDataDescriptor(undefined), false, 'undefined value is not a Data Descriptor');

	t.equal(ES.IsDataDescriptor(v.accessorDescriptor()), false, 'accessor descriptor is not a Data Descriptor');
	t.equal(ES.IsDataDescriptor(v.mutatorDescriptor()), false, 'mutator descriptor is not a Data Descriptor');
	t.equal(ES.IsDataDescriptor(v.dataDescriptor()), true, 'data descriptor is a Data Descriptor');
	t.equal(ES.IsDataDescriptor(v.genericDescriptor()), false, 'generic descriptor is not a Data Descriptor');

	t.end();
});

test('IsGenericDescriptor', function (t) {
	forEach(v.nonNullPrimitives.concat(null), function (primitive) {
		t['throws'](
			function () { ES.IsGenericDescriptor(primitive); },
			TypeError,
			debug(primitive) + ' is not a Property Descriptor'
		);
	});

	t.equal(ES.IsGenericDescriptor(), false, 'no value is not a Data Descriptor');
	t.equal(ES.IsGenericDescriptor(undefined), false, 'undefined value is not a Data Descriptor');

	t.equal(ES.IsGenericDescriptor(v.accessorDescriptor()), false, 'accessor descriptor is not a generic Descriptor');
	t.equal(ES.IsGenericDescriptor(v.mutatorDescriptor()), false, 'mutator descriptor is not a generic Descriptor');
	t.equal(ES.IsGenericDescriptor(v.dataDescriptor()), false, 'data descriptor is not a generic Descriptor');

	t.equal(ES.IsGenericDescriptor(v.genericDescriptor()), true, 'generic descriptor is a generic Descriptor');

	t.end();
});

test('FromPropertyDescriptor', function (t) {
	t.equal(ES.FromPropertyDescriptor(), undefined, 'no value begets undefined');
	t.equal(ES.FromPropertyDescriptor(undefined), undefined, 'undefined value begets undefined');

	forEach(v.nonNullPrimitives.concat(null), function (primitive) {
		t['throws'](
			function () { ES.FromPropertyDescriptor(primitive); },
			TypeError,
			debug(primitive) + ' is not a Property Descriptor'
		);
	});

	var accessor = v.accessorDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(accessor), {
		get: accessor['[[Get]]'],
		set: accessor['[[Set]]'],
		enumerable: !!accessor['[[Enumerable]]'],
		configurable: !!accessor['[[Configurable]]']
	});

	var mutator = v.mutatorDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(mutator), {
		get: mutator['[[Get]]'],
		set: mutator['[[Set]]'],
		enumerable: !!mutator['[[Enumerable]]'],
		configurable: !!mutator['[[Configurable]]']
	});
	var data = v.dataDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(data), {
		value: data['[[Value]]'],
		writable: data['[[Writable]]'],
		enumerable: !!data['[[Enumerable]]'],
		configurable: !!data['[[Configurable]]']
	});

	t['throws'](
		function () { ES.FromPropertyDescriptor(v.genericDescriptor()); },
		TypeError,
		'a complete Property Descriptor is required'
	);

	t.end();
});

test('ToPropertyDescriptor', function (t) {
	forEach(v.nonNullPrimitives.concat(null), function (primitive) {
		t['throws'](
			function () { ES.ToPropertyDescriptor(primitive); },
			TypeError,
			debug(primitive) + ' is not an Object'
		);
	});

	var accessor = v.accessorDescriptor();
	t.deepEqual(ES.ToPropertyDescriptor({
		get: accessor['[[Get]]'],
		enumerable: !!accessor['[[Enumerable]]'],
		configurable: !!accessor['[[Configurable]]']
	}), accessor);

	var mutator = v.mutatorDescriptor();
	t.deepEqual(ES.ToPropertyDescriptor({
		set: mutator['[[Set]]'],
		enumerable: !!mutator['[[Enumerable]]'],
		configurable: !!mutator['[[Configurable]]']
	}), mutator);

	var data = v.descriptors.nonConfigurable(v.dataDescriptor());
	t.deepEqual(ES.ToPropertyDescriptor({
		value: data['[[Value]]'],
		writable: data['[[Writable]]'],
		configurable: !!data['[[Configurable]]']
	}), data);

	var both = v.bothDescriptor();
	t['throws'](
		function () {
			ES.ToPropertyDescriptor({ get: both['[[Get]]'], value: both['[[Value]]'] });
		},
		TypeError,
		'data and accessor descriptors are mutually exclusive'
	);

	t['throws'](
		function () { ES.ToPropertyDescriptor({ get: 'not callable' }); },
		TypeError,
		'"get" must be undefined or callable'
	);

	t['throws'](
		function () { ES.ToPropertyDescriptor({ set: 'not callable' }); },
		TypeError,
		'"set" must be undefined or callable'
	);

	t.end();
});

test('Abstract Equality Comparison', function (t) {
	t.test('same types use ===', function (st) {
		forEach(v.primitives.concat(v.objects), function (value) {
			st.equal(ES['Abstract Equality Comparison'](value, value), value === value, debug(value) + ' is abstractly equal to itself');
		});
		st.end();
	});

	t.test('different types coerce', function (st) {
		var pairs = [
			[null, undefined],
			[3, '3'],
			[true, '3'],
			[true, 3],
			[false, 0],
			[false, '0'],
			[3, [3]],
			['3', [3]],
			[true, [1]],
			[false, [0]],
			[String(v.coercibleObject), v.coercibleObject],
			[Number(String(v.coercibleObject)), v.coercibleObject],
			[Number(v.coercibleObject), v.coercibleObject],
			[String(Number(v.coercibleObject)), v.coercibleObject]
		];
		forEach(pairs, function (pair) {
			var a = pair[0];
			var b = pair[1];
			// eslint-disable-next-line eqeqeq
			st.equal(ES['Abstract Equality Comparison'](a, b), a == b, debug(a) + ' == ' + debug(b));
			// eslint-disable-next-line eqeqeq
			st.equal(ES['Abstract Equality Comparison'](b, a), b == a, debug(b) + ' == ' + debug(a));
		});
		st.end();
	});

	t.end();
});

test('Strict Equality Comparison', function (t) {
	t.test('same types use ===', function (st) {
		forEach(v.primitives.concat(v.objects), function (value) {
			st.equal(ES['Strict Equality Comparison'](value, value), value === value, debug(value) + ' is strictly equal to itself');
		});
		st.end();
	});

	t.test('different types are not ===', function (st) {
		var pairs = [
			[null, undefined],
			[3, '3'],
			[true, '3'],
			[true, 3],
			[false, 0],
			[false, '0'],
			[3, [3]],
			['3', [3]],
			[true, [1]],
			[false, [0]],
			[String(v.coercibleObject), v.coercibleObject],
			[Number(String(v.coercibleObject)), v.coercibleObject],
			[Number(v.coercibleObject), v.coercibleObject],
			[String(Number(v.coercibleObject)), v.coercibleObject]
		];
		forEach(pairs, function (pair) {
			var a = pair[0];
			var b = pair[1];
			st.equal(ES['Strict Equality Comparison'](a, b), a === b, debug(a) + ' === ' + debug(b));
			st.equal(ES['Strict Equality Comparison'](b, a), b === a, debug(b) + ' === ' + debug(a));
		});
		st.end();
	});

	t.end();
});

test('Abstract Relational Comparison', function (t) {
	t.test('at least one operand is NaN', function (st) {
		st.equal(ES['Abstract Relational Comparison'](NaN, {}, true), undefined, 'LeftFirst: first is NaN, returns undefined');
		st.equal(ES['Abstract Relational Comparison']({}, NaN, true), undefined, 'LeftFirst: second is NaN, returns undefined');
		st.equal(ES['Abstract Relational Comparison'](NaN, {}, false), undefined, '!LeftFirst: first is NaN, returns undefined');
		st.equal(ES['Abstract Relational Comparison']({}, NaN, false), undefined, '!LeftFirst: second is NaN, returns undefined');
		st.end();
	});

	t.equal(ES['Abstract Relational Comparison'](3, 4, true), true, 'LeftFirst: 3 is less than 4');
	t.equal(ES['Abstract Relational Comparison'](4, 3, true), false, 'LeftFirst: 3 is not less than 4');
	t.equal(ES['Abstract Relational Comparison'](3, 4, false), true, '!LeftFirst: 3 is less than 4');
	t.equal(ES['Abstract Relational Comparison'](4, 3, false), false, '!LeftFirst: 3 is not less than 4');

	t.equal(ES['Abstract Relational Comparison']('3', '4', true), true, 'LeftFirst: "3" is less than "4"');
	t.equal(ES['Abstract Relational Comparison']('4', '3', true), false, 'LeftFirst: "3" is not less than "4"');
	t.equal(ES['Abstract Relational Comparison']('3', '4', false), true, '!LeftFirst: "3" is less than "4"');
	t.equal(ES['Abstract Relational Comparison']('4', '3', false), false, '!LeftFirst: "3" is not less than "4"');

	t.equal(ES['Abstract Relational Comparison'](v.coercibleObject, 42, true), true, 'LeftFirst: coercible object is less than 42');
	t.equal(ES['Abstract Relational Comparison'](42, v.coercibleObject, true), false, 'LeftFirst: 42 is not less than coercible object');
	t.equal(ES['Abstract Relational Comparison'](v.coercibleObject, 42, false), true, '!LeftFirst: coercible object is less than 42');
	t.equal(ES['Abstract Relational Comparison'](42, v.coercibleObject, false), false, '!LeftFirst: 42 is not less than coercible object');

	t.equal(ES['Abstract Relational Comparison'](v.coercibleObject, '3', true), false, 'LeftFirst: coercible object is not less than "3"');
	t.equal(ES['Abstract Relational Comparison']('3', v.coercibleObject, true), false, 'LeftFirst: "3" is not less than coercible object');
	t.equal(ES['Abstract Relational Comparison'](v.coercibleObject, '3', false), false, '!LeftFirst: coercible object is not less than "3"');
	t.equal(ES['Abstract Relational Comparison']('3', v.coercibleObject, false), false, '!LeftFirst: "3" is not less than coercible object');

	t.end();
});

test('FromPropertyDescriptor', function (t) {
	t.equal(ES.FromPropertyDescriptor(), undefined, 'no value begets undefined');
	t.equal(ES.FromPropertyDescriptor(undefined), undefined, 'undefined value begets undefined');

	forEach(v.nonUndefinedPrimitives, function (primitive) {
		t['throws'](
			function () { ES.FromPropertyDescriptor(primitive); },
			TypeError,
			debug(primitive) + ' is not a Property Descriptor'
		);
	});

	var accessor = v.accessorDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(accessor), {
		get: accessor['[[Get]]'],
		set: accessor['[[Set]]'],
		enumerable: !!accessor['[[Enumerable]]'],
		configurable: !!accessor['[[Configurable]]']
	});

	var mutator = v.mutatorDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(mutator), {
		get: mutator['[[Get]]'],
		set: mutator['[[Set]]'],
		enumerable: !!mutator['[[Enumerable]]'],
		configurable: !!mutator['[[Configurable]]']
	});
	var data = v.dataDescriptor();
	t.deepEqual(ES.FromPropertyDescriptor(data), {
		value: data['[[Value]]'],
		writable: data['[[Writable]]'],
		enumerable: !!data['[[Enumerable]]'],
		configurable: !!data['[[Configurable]]']
	});

	t['throws'](
		function () { ES.FromPropertyDescriptor(v.genericDescriptor()); },
		TypeError,
		'a complete Property Descriptor is required'
	);

	t.end();
});

test('SecFromTime', function (t) {
	var now = new Date();
	t.equal(ES.SecFromTime(now.getTime()), now.getUTCSeconds(), 'second from Date timestamp matches getUTCSeconds');
	t.end();
});

test('MinFromTime', function (t) {
	var now = new Date();
	t.equal(ES.MinFromTime(now.getTime()), now.getUTCMinutes(), 'minute from Date timestamp matches getUTCMinutes');
	t.end();
});

test('HourFromTime', function (t) {
	var now = new Date();
	t.equal(ES.HourFromTime(now.getTime()), now.getUTCHours(), 'hour from Date timestamp matches getUTCHours');
	t.end();
});

test('msFromTime', function (t) {
	var now = new Date();
	t.equal(ES.msFromTime(now.getTime()), now.getUTCMilliseconds(), 'ms from Date timestamp matches getUTCMilliseconds');
	t.end();
});

var msPerSecond = 1e3;
var msPerMinute = 60 * msPerSecond;
var msPerHour = 60 * msPerMinute;
var msPerDay = 24 * msPerHour;

test('Day', function (t) {
	var time = Date.UTC(2019, 8, 10, 2, 3, 4, 5);
	var add = 2.5;
	var later = new Date(time + (add * msPerDay));

	t.equal(ES.Day(later.getTime()), ES.Day(time) + Math.floor(add), 'adding 2.5 days worth of ms, gives a Day delta of 2');
	t.end();
});

test('TimeWithinDay', function (t) {
	var time = Date.UTC(2019, 8, 10, 2, 3, 4, 5);
	var add = 2.5;
	var later = new Date(time + (add * msPerDay));

	t.equal(ES.TimeWithinDay(later.getTime()), ES.TimeWithinDay(time) + (0.5 * msPerDay), 'adding 2.5 days worth of ms, gives a TimeWithinDay delta of +0.5');
	t.end();
});

test('DayFromYear', function (t) {
	t.equal(ES.DayFromYear(2021) - ES.DayFromYear(2020), 366, '2021 is a leap year, has 366 days');
	t.equal(ES.DayFromYear(2020) - ES.DayFromYear(2019), 365, '2020 is not a leap year, has 365 days');
	t.equal(ES.DayFromYear(2019) - ES.DayFromYear(2018), 365, '2019 is not a leap year, has 365 days');
	t.equal(ES.DayFromYear(2018) - ES.DayFromYear(2017), 365, '2018 is not a leap year, has 365 days');
	t.equal(ES.DayFromYear(2017) - ES.DayFromYear(2016), 366, '2017 is a leap year, has 366 days');

	t.end();
});

test('TimeFromYear', function (t) {
	for (var i = 1900; i < 2100; i += 1) {
		t.equal(ES.TimeFromYear(i), Date.UTC(i, 0, 1), 'TimeFromYear matches a Date object’s year: ' + i);
	}
	t.end();
});

test('YearFromTime', function (t) {
	for (var i = 1900; i < 2100; i += 1) {
		t.equal(ES.YearFromTime(Date.UTC(i, 0, 1)), i, 'YearFromTime matches a Date object’s year on 1/1: ' + i);
		t.equal(ES.YearFromTime(Date.UTC(i, 10, 1)), i, 'YearFromTime matches a Date object’s year on 10/1: ' + i);
	}
	t.end();
});

test('WeekDay', function (t) {
	var now = new Date();
	var today = now.getUTCDay();
	for (var i = 0; i < 7; i += 1) {
		var weekDay = ES.WeekDay(now.getTime() + (i * msPerDay));
		t.equal(weekDay, (today + i) % 7, i + ' days after today (' + today + '), WeekDay is ' + weekDay);
	}
	t.end();
});

test('DaysInYear', function (t) {
	t.equal(ES.DaysInYear(2021), 365, '2021 is not a leap year');
	t.equal(ES.DaysInYear(2020), 366, '2020 is a leap year');
	t.equal(ES.DaysInYear(2019), 365, '2019 is not a leap year');
	t.equal(ES.DaysInYear(2018), 365, '2018 is not a leap year');
	t.equal(ES.DaysInYear(2017), 365, '2017 is not a leap year');
	t.equal(ES.DaysInYear(2016), 366, '2016 is a leap year');

	t.end();
});

test('InLeapYear', function (t) {
	t.equal(ES.InLeapYear(Date.UTC(2021, 0, 1)), 0, '2021 is not a leap year');
	t.equal(ES.InLeapYear(Date.UTC(2020, 0, 1)), 1, '2020 is a leap year');
	t.equal(ES.InLeapYear(Date.UTC(2019, 0, 1)), 0, '2019 is not a leap year');
	t.equal(ES.InLeapYear(Date.UTC(2018, 0, 1)), 0, '2018 is not a leap year');
	t.equal(ES.InLeapYear(Date.UTC(2017, 0, 1)), 0, '2017 is not a leap year');
	t.equal(ES.InLeapYear(Date.UTC(2016, 0, 1)), 1, '2016 is a leap year');

	t.end();
});

test('DayWithinYear', function (t) {
	t.equal(ES.DayWithinYear(Date.UTC(2019, 0, 1)), 0, '1/1 is the 1st day');
	t.equal(ES.DayWithinYear(Date.UTC(2019, 11, 31)), 364, '12/31 is the 365th day in a non leap year');
	t.equal(ES.DayWithinYear(Date.UTC(2016, 11, 31)), 365, '12/31 is the 366th day in a leap year');

	t.end();
});

test('MonthFromTime', function (t) {
	t.equal(ES.MonthFromTime(Date.UTC(2019, 0, 1)), 0, 'non-leap: 1/1 gives January');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 0, 31)), 0, 'non-leap: 1/31 gives January');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 1, 1)), 1, 'non-leap: 2/1 gives February');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 1, 28)), 1, 'non-leap: 2/28 gives February');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 1, 29)), 2, 'non-leap: 2/29 gives March');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 2, 1)), 2, 'non-leap: 3/1 gives March');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 2, 31)), 2, 'non-leap: 3/31 gives March');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 3, 1)), 3, 'non-leap: 4/1 gives April');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 3, 30)), 3, 'non-leap: 4/30 gives April');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 4, 1)), 4, 'non-leap: 5/1 gives May');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 4, 31)), 4, 'non-leap: 5/31 gives May');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 5, 1)), 5, 'non-leap: 6/1 gives June');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 5, 30)), 5, 'non-leap: 6/30 gives June');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 6, 1)), 6, 'non-leap: 7/1 gives July');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 6, 31)), 6, 'non-leap: 7/31 gives July');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 7, 1)), 7, 'non-leap: 8/1 gives August');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 7, 30)), 7, 'non-leap: 8/30 gives August');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 8, 1)), 8, 'non-leap: 9/1 gives September');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 8, 30)), 8, 'non-leap: 9/30 gives September');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 9, 1)), 9, 'non-leap: 10/1 gives October');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 9, 31)), 9, 'non-leap: 10/31 gives October');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 10, 1)), 10, 'non-leap: 11/1 gives November');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 10, 30)), 10, 'non-leap: 11/30 gives November');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 11, 1)), 11, 'non-leap: 12/1 gives December');
	t.equal(ES.MonthFromTime(Date.UTC(2019, 11, 31)), 11, 'non-leap: 12/31 gives December');

	t.equal(ES.MonthFromTime(Date.UTC(2016, 0, 1)), 0, 'leap: 1/1 gives January');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 0, 31)), 0, 'leap: 1/31 gives January');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 1, 1)), 1, 'leap: 2/1 gives February');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 1, 28)), 1, 'leap: 2/28 gives February');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 1, 29)), 1, 'leap: 2/29 gives February');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 2, 1)), 2, 'leap: 3/1 gives March');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 2, 31)), 2, 'leap: 3/31 gives March');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 3, 1)), 3, 'leap: 4/1 gives April');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 3, 30)), 3, 'leap: 4/30 gives April');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 4, 1)), 4, 'leap: 5/1 gives May');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 4, 31)), 4, 'leap: 5/31 gives May');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 5, 1)), 5, 'leap: 6/1 gives June');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 5, 30)), 5, 'leap: 6/30 gives June');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 6, 1)), 6, 'leap: 7/1 gives July');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 6, 31)), 6, 'leap: 7/31 gives July');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 7, 1)), 7, 'leap: 8/1 gives August');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 7, 30)), 7, 'leap: 8/30 gives August');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 8, 1)), 8, 'leap: 9/1 gives September');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 8, 30)), 8, 'leap: 9/30 gives September');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 9, 1)), 9, 'leap: 10/1 gives October');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 9, 31)), 9, 'leap: 10/31 gives October');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 10, 1)), 10, 'leap: 11/1 gives November');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 10, 30)), 10, 'leap: 11/30 gives November');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 11, 1)), 11, 'leap: 12/1 gives December');
	t.equal(ES.MonthFromTime(Date.UTC(2016, 11, 31)), 11, 'leap: 12/31 gives December');
	t.end();
});

test('DateFromTime', function (t) {
	var i;
	for (i = 1; i <= 28; i += 1) {
		t.equal(ES.DateFromTime(Date.UTC(2019, 1, i)), i, '2019.02.' + i + ' is date ' + i);
	}
	for (i = 1; i <= 29; i += 1) {
		t.equal(ES.DateFromTime(Date.UTC(2016, 1, i)), i, '2016.02.' + i + ' is date ' + i);
	}
	for (i = 1; i <= 30; i += 1) {
		t.equal(ES.DateFromTime(Date.UTC(2019, 8, i)), i, '2019.09.' + i + ' is date ' + i);
	}
	for (i = 1; i <= 31; i += 1) {
		t.equal(ES.DateFromTime(Date.UTC(2019, 9, i)), i, '2019.10.' + i + ' is date ' + i);
	}
	t.end();
});

test('MakeDay', function (t) {
	var day2015 = 16687;
	t.equal(ES.MakeDay(2015, 8, 9), day2015, '2015.09.09 is day 16687');
	var day2016 = day2015 + 366; // 2016 is a leap year
	t.equal(ES.MakeDay(2016, 8, 9), day2016, '2015.09.09 is day 17053');
	var day2017 = day2016 + 365;
	t.equal(ES.MakeDay(2017, 8, 9), day2017, '2017.09.09 is day 17418');
	var day2018 = day2017 + 365;
	t.equal(ES.MakeDay(2018, 8, 9), day2018, '2018.09.09 is day 17783');
	var day2019 = day2018 + 365;
	t.equal(ES.MakeDay(2019, 8, 9), day2019, '2019.09.09 is day 18148');
	t.end();
});

test('MakeDate', function (t) {
	forEach(v.infinities.concat(NaN), function (nonFiniteNumber) {
		t.ok(is(ES.MakeDate(nonFiniteNumber, 0), NaN), debug(nonFiniteNumber) + ' is not a finite `day`');
		t.ok(is(ES.MakeDate(0, nonFiniteNumber), NaN), debug(nonFiniteNumber) + ' is not a finite `time`');
	});
	t.equal(ES.MakeDate(0, 0), 0, 'zero day and zero time is zero date');
	t.equal(ES.MakeDate(0, 123), 123, 'zero day and nonzero time is a date of the "time"');
	t.equal(ES.MakeDate(1, 0), msPerDay, 'day of 1 and zero time is a date of "ms per day"');
	t.equal(ES.MakeDate(3, 0), 3 * msPerDay, 'day of 3 and zero time is a date of thrice "ms per day"');
	t.equal(ES.MakeDate(1, 123), msPerDay + 123, 'day of 1 and nonzero time is a date of "ms per day" plus the "time"');
	t.equal(ES.MakeDate(3, 123), (3 * msPerDay) + 123, 'day of 3 and nonzero time is a date of thrice "ms per day" plus the "time"');

	t.end();
});

test('MakeTime', function (t) {
	forEach(v.infinities.concat(NaN), function (nonFiniteNumber) {
		t.ok(is(ES.MakeTime(nonFiniteNumber, 0, 0, 0), NaN), debug(nonFiniteNumber) + ' is not a finite `hour`');
		t.ok(is(ES.MakeTime(0, nonFiniteNumber, 0, 0), NaN), debug(nonFiniteNumber) + ' is not a finite `min`');
		t.ok(is(ES.MakeTime(0, 0, nonFiniteNumber, 0), NaN), debug(nonFiniteNumber) + ' is not a finite `sec`');
		t.ok(is(ES.MakeTime(0, 0, 0, nonFiniteNumber), NaN), debug(nonFiniteNumber) + ' is not a finite `ms`');
	});

	t.equal(
		ES.MakeTime(1.2, 2.3, 3.4, 4.5),
		(1 * msPerHour) + (2 * msPerMinute) + (3 * msPerSecond) + 4,
		'all numbers are converted to integer, multiplied by the right number of ms, and summed'
	);
	t.end();
});

test('TimeClip', function (t) {
	forEach(v.infinities.concat(NaN), function (nonFiniteNumber) {
		t.ok(is(ES.TimeClip(nonFiniteNumber), NaN), debug(nonFiniteNumber) + ' is not a finite `time`');
	});
	t.ok(is(ES.TimeClip(8.64e15 + 1), NaN), '8.64e15 is the largest magnitude considered "finite"');
	t.ok(is(ES.TimeClip(-8.64e15 - 1), NaN), '-8.64e15 is the largest magnitude considered "finite"');

	forEach(v.zeroes.concat([-10, 10, +new Date()]), function (time) {
		t.equal(ES.TimeClip(time), time, debug(time) + ' is a time of ' + debug(time));
	});

	t.end();
});

test('modulo', function (t) {
	t.equal(3 % 2, 1, '+3 % 2 is +1');
	t.equal(ES.modulo(3, 2), 1, '+3 mod 2 is +1');

	t.equal(-3 % 2, -1, '-3 % 2 is -1');
	t.equal(ES.modulo(-3, 2), 1, '-3 mod 2 is +1');
	t.end();
});
