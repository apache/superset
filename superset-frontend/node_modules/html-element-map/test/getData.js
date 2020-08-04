'use strict';

var test = require('tape');
var isArray = require('isarray');
var forEach = require('for-each');
var functionName = require('function.prototype.name');
var inspect = require('object-inspect');

var getData = require('../getData');

var testConstructor = function testConstructorTag(t, constructor, tag, name, desc) {
	if (!constructor) {
		t.equal(typeof constructor, 'undefined', desc + ' does not exist');
		return;
	}

	if (typeof constructor === 'object') {
		t.equal(typeof constructor, 'object', desc + ' is type "object"');

		var objName = Object.prototype.toString.call(constructor).slice(8, -1);
		if (objName === name || (objName !== 'HTMLElement' && name !== 'HTMLElement')) {
			t.equal(objName, name, desc + ' toString [[Class]] matches constructorName');
		}
	} if (typeof constructor === 'function') {
		t.equal(typeof constructor, 'function', desc + ' is a function');

		var actualName = functionName(constructor);
		if (actualName === name || (actualName !== 'HTMLElement' && name !== 'HTMLElement')) {
			t.equal(actualName, name, desc + ' name matches constructorName');
		}
	} else {
		t.comment('constructor is not a function # SKIP');
		return;
	}

	if (typeof document === 'undefined') {
		t.comment('no document available # SKIP');
	} else {
		t.equal(document.createElement(tag) instanceof constructor, true, 'element is instanceof ' + desc);
	}
};

test('getData()', function (t) {
	t.equal(typeof getData, 'function', 'is a function');

	var data = getData();
	t.equal(isArray(data.elements), true, 'data.elements is an array');

	t.equal(data.unknown, global.HTMLUnknownElement, '"unknown" is present');
	t.equal(data.all, global.HTMLElement, '"all" is present');

	t.test('all the elements', function (st) {
		forEach(data.elements, function (item) {
			st.test(inspect(item), function (s2t) {
				s2t.equal(typeof item.tag, 'string', 'tag is a string');
				s2t.ok(item.tag, 'tag is not empty');

				s2t.equal(typeof item.constructorName, 'string', 'constructorName is a string');
				s2t.ok(item.constructorName, 'constructorName is not empty');

				testConstructor(s2t, item.constructor, item.tag, item.constructorName, 'constructor');
				testConstructor(s2t, item.expectedConstructor, item.tag, item.constructorName, 'expected constructor');

				s2t.end();
			});
		});

		st.end();
	});
});
