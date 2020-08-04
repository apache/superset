'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $iterator = GetIntrinsic('%Symbol.iterator%', true);

var callBound = require('../helpers/callBound');

var $arrayJoin = callBound('Array.prototype.join');
var $arrayPush = callBound('Array.prototype.push');
var $stringSlice = callBound('String.prototype.slice');
var $stringSplit = callBound('String.prototype.split');

var AdvanceStringIndex = require('./AdvanceStringIndex');
var GetIterator = require('./GetIterator');
var GetMethod = require('./GetMethod');
var IsArray = require('./IsArray');
var IteratorStep = require('./IteratorStep');
var IteratorValue = require('./IteratorValue');
var ToObject = require('./ToObject');
var Type = require('./Type');

// https://www.ecma-international.org/ecma-262/7.0/#sec-iterabletoarraylike

module.exports = function IterableToArrayLike(items) {
	var usingIterator;
	if ($iterator) {
		usingIterator = GetMethod(items, $iterator);
	} else if (IsArray(items)) {
		usingIterator = function () {
			var i = -1;
			var arr = this; // eslint-disable-line no-invalid-this
			return {
				next: function () {
					i += 1;
					return {
						done: i >= arr.length,
						value: arr[i]
					};
				}
			};
		};
	} else if (Type(items) === 'String') {
		usingIterator = function () {
			var i = 0;
			return {
				next: function () {
					var nextIndex = AdvanceStringIndex(items, i, true);
					var value = $arrayJoin($stringSplit($stringSlice(items, i, nextIndex), ''), '');
					i = nextIndex;
					return {
						done: nextIndex > items.length,
						value: value
					};
				}
			};
		};
	}
	if (typeof usingIterator !== 'undefined') {
		var iterator = GetIterator(items, usingIterator);
		var values = [];
		var next = true;
		while (next) {
			next = IteratorStep(iterator);
			if (next) {
				var nextValue = IteratorValue(next);
				$arrayPush(values, nextValue);
			}
		}
		return values;
	}

	return ToObject(items);
};
