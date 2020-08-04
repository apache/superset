'use strict';

var assign = require('../../helpers/assign');

var hasSymbols = require('has-symbols')();

var coercibleObject = { valueOf: function () { return 3; }, toString: function () { return 42; } };
var coercibleFnObject = {
	valueOf: function () { return function valueOfFn() {}; },
	toString: function () { return 42; }
};
var valueOfOnlyObject = { valueOf: function () { return 4; }, toString: function () { return {}; } };
var toStringOnlyObject = { valueOf: function () { return {}; }, toString: function () { return 7; } };
var uncoercibleObject = { valueOf: function () { return {}; }, toString: function () { return {}; } };
var uncoercibleFnObject = {
	valueOf: function () { return function valueOfFn() {}; },
	toString: function () { return function toStrFn() {}; }
};
var objects = [{}, coercibleObject, coercibleFnObject, toStringOnlyObject, valueOfOnlyObject];
var nullPrimitives = [undefined, null];
var nonIntegerNumbers = [-1.3, 0.2, 1.8, 1 / 3];
var zeroes = [0, -0];
var infinities = [Infinity, -Infinity];
var numbers = zeroes.concat([42], infinities, nonIntegerNumbers);
var strings = ['', 'foo', 'a\uD83D\uDCA9c'];
var booleans = [true, false];
var symbols = hasSymbols ? [Symbol.iterator, Symbol('foo')] : [];
var nonSymbolPrimitives = [].concat(nullPrimitives, booleans, strings, numbers);
var nonNumberPrimitives = [].concat(nullPrimitives, booleans, strings, symbols);
var nonNullPrimitives = [].concat(booleans, strings, numbers, symbols);
var nonUndefinedPrimitives = [].concat(null, nonNullPrimitives);
var nonStrings = [].concat(nullPrimitives, booleans, numbers, symbols, objects);
var primitives = [].concat(nullPrimitives, nonNullPrimitives);
var nonPropertyKeys = [].concat(nullPrimitives, booleans, numbers, objects);
var propertyKeys = [].concat(strings, symbols);
var nonBooleans = [].concat(nullPrimitives, strings, symbols, numbers, objects);
var falsies = [].concat(nullPrimitives, false, '', 0, -0, NaN);
var truthies = [].concat(true, 'foo', 42, symbols, objects);
var timestamps = [].concat(0, 946713600000, 1546329600000);
var nonFunctions = [].concat(primitives, objects, [42]);
var nonArrays = [].concat(nonFunctions);

var descriptors = {
	configurable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Configurable]]': true });
	},
	nonConfigurable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Configurable]]': false });
	},
	enumerable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Enumerable]]': true });
	},
	nonEnumerable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Enumerable]]': false });
	},
	writable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Writable]]': true });
	},
	nonWritable: function (descriptor) {
		return assign(assign({}, descriptor), { '[[Writable]]': false });
	}
};

module.exports = {
	coercibleObject: coercibleObject,
	coercibleFnObject: coercibleFnObject,
	valueOfOnlyObject: valueOfOnlyObject,
	toStringOnlyObject: toStringOnlyObject,
	uncoercibleObject: uncoercibleObject,
	uncoercibleFnObject: uncoercibleFnObject,
	objects: objects,
	nonFunctions: nonFunctions,
	nonArrays: nonArrays,
	nullPrimitives: nullPrimitives,
	numbers: numbers,
	zeroes: zeroes,
	infinities: infinities,
	strings: strings,
	booleans: booleans,
	symbols: symbols,
	hasSymbols: hasSymbols,
	nonSymbolPrimitives: nonSymbolPrimitives,
	nonNumberPrimitives: nonNumberPrimitives,
	nonNullPrimitives: nonNullPrimitives,
	nonUndefinedPrimitives: nonUndefinedPrimitives,
	nonStrings: nonStrings,
	nonNumbers: nonNumberPrimitives.concat(objects),
	nonIntegerNumbers: nonIntegerNumbers,
	primitives: primitives,
	nonPropertyKeys: nonPropertyKeys,
	propertyKeys: propertyKeys,
	nonBooleans: nonBooleans,
	falsies: falsies,
	truthies: truthies,
	timestamps: timestamps,
	bothDescriptor: function () {
		return { '[[Get]]': function () {}, '[[Value]]': true };
	},
	bothDescriptorWritable: function () {
		return descriptors.writable({ '[[Get]]': function () {} });
	},
	accessorDescriptor: function (value) {
		return descriptors.enumerable(descriptors.configurable({
			'[[Get]]': function get() { return value; }
		}));
	},
	mutatorDescriptor: function () {
		return descriptors.enumerable(descriptors.configurable({
			'[[Set]]': function () {}
		}));
	},
	dataDescriptor: function (value) {
		return descriptors.nonWritable({
			'[[Value]]': arguments.length > 0 ? value : 42
		});
	},
	genericDescriptor: function () {
		return descriptors.configurable(descriptors.nonEnumerable());
	},
	descriptors: descriptors
};
