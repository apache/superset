'use strict';

var flags = require('../');
var test = require('tape');
var has = require('has');

var getRegexLiteral = function (stringRegex) {
	try {
		/* jshint evil: true */
		/* eslint-disable no-new-func */
		return Function('return ' + stringRegex + ';')();
		/* eslint-enable no-new-func */
		/* jshint evil: false */
	} catch (e) { /**/ }
	return null;
};

flags.shim();
var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, 'flags');
var testGenericFlags = function (object) {
	return descriptor.get.call(object);
};

test('works as a function', function (t) {
	t.equal(flags(/a/g), 'g', 'flags(/a/g) !== "g"');
	t.equal(flags(/a/gmi), 'gim', 'flags(/a/gmi) !== "gim"');
	t.equal(flags(new RegExp('a', 'gmi')), 'gim', 'flags(new RegExp("a", "gmi")) !== "gim"');
	t.equal(flags(/a/), '', 'flags(/a/) !== ""');
	t.equal(flags(new RegExp('a')), '', 'flags(new RegExp("a")) !== ""');

	t.test('sticky flag', { skip: !has(RegExp.prototype, 'sticky') }, function (st) {
		st.equal(flags(getRegexLiteral('/a/y')), 'y', 'flags(/a/y) !== "y"');
		st.equal(flags(new RegExp('a', 'y')), 'y', 'flags(new RegExp("a", "y")) !== "y"');
		st.end();
	});

	t.test('unicode flag', { skip: !has(RegExp.prototype, 'unicode') }, function (st) {
		st.equal(flags(getRegexLiteral('/a/u')), 'u', 'flags(/a/u) !== "u"');
		st.equal(flags(new RegExp('a', 'u')), 'u', 'flags(new RegExp("a", "u")) !== "u"');
		st.end();
	});

	t.test('dotAll flag', { skip: !has(RegExp.prototype, 'dotAll') }, function (st) {
		st.equal(flags(getRegexLiteral('/a/s')), 's', 'flags(/a/s) !== "s"');
		st.equal(flags(new RegExp('a', 's')), 's', 'flags(new RegExp("a", "s")) !== "s"');
		st.end();
	});

	t.test('sorting', function (st) {
		st.equal(flags(/a/gim), 'gim', 'flags(/a/gim) !== "gim"');
		st.equal(flags(/a/mig), 'gim', 'flags(/a/mig) !== "gim"');
		st.equal(flags(/a/mgi), 'gim', 'flags(/a/mgi) !== "gim"');
		if (has(RegExp.prototype, 'sticky')) {
			st.equal(flags(getRegexLiteral('/a/gyim')), 'gimy', 'flags(/a/gyim) !== "gimy"');
		}
		if (has(RegExp.prototype, 'unicode')) {
			st.equal(flags(getRegexLiteral('/a/ugmi')), 'gimu', 'flags(/a/ugmi) !== "gimu"');
		}
		if (has(RegExp.prototype, 'dotAll')) {
			st.equal(flags(getRegexLiteral('/a/sgmi')), 'gims', 'flags(/a/sgmi) !== "gims"');
		}
		st.end();
	});

	t.test('throws properly', function (st) {
		var nonObjects = ['', false, true, 42, NaN, null, undefined];
		st.plan(nonObjects.length);
		var throwsOnNonObject = function (nonObject) {
			st['throws'](Function.call.bind(nonObject), TypeError);
		};
		nonObjects.forEach(throwsOnNonObject);
	});
	t.end();
});

test('shims properly', function (t) {
	t.test('basic examples', function (st) {
		st.equal((/a/g).flags, 'g', '(/a/g).flags !== "g"');
		st.equal((/a/gmi).flags, 'gim', '(/a/gmi).flags !== "gim"');
		st.equal(new RegExp('a', 'gmi').flags, 'gim', 'new RegExp("a", "gmi").flags !== "gim"');
		st.equal((/a/).flags, '', '(/a/).flags !== ""');
		st.equal(new RegExp('a').flags, '', 'new RegExp("a").flags !== ""');
		st.end();
	});

	t.test('sticky flag', { skip: !has(RegExp.prototype, 'sticky') }, function (st) {
		st.equal(getRegexLiteral('/a/y').flags, 'y', '(/a/y).flags !== "y"');
		st.equal(new RegExp('a', 'y').flags, 'y', 'new RegExp("a", "y").flags !== "y"');
		st.end();
	});

	t.test('unicode flag', { skip: !has(RegExp.prototype, 'unicode') }, function (st) {
		st.equal(getRegexLiteral('/a/u').flags, 'u', '(/a/u).flags !== "u"');
		st.equal(new RegExp('a', 'u').flags, 'u', 'new RegExp("a", "u").flags !== "u"');
		st.end();
	});

	t.test('dotAll flag', { skip: !has(RegExp.prototype, 'dotAll') }, function (st) {
		st.equal(getRegexLiteral('/a/s').flags, 's', '(/a/s).flags !== "s"');
		st.equal(new RegExp('a', 's').flags, 's', 'new RegExp("a", "s").flags !== "s"');
		st.end();
	});

	t.test('sorting', function (st) {
		st.equal((/a/gim).flags, 'gim', '(/a/gim).flags !== "gim"');
		st.equal((/a/mig).flags, 'gim', '(/a/mig).flags !== "gim"');
		st.equal((/a/mgi).flags, 'gim', '(/a/mgi).flags !== "gim"');
		if (has(RegExp.prototype, 'sticky')) {
			st.equal(getRegexLiteral('/a/gyim').flags, 'gimy', '(/a/gyim).flags !== "gimy"');
		}
		if (has(RegExp.prototype, 'unicode')) {
			st.equal(getRegexLiteral('/a/ugmi').flags, 'gimu', '(/a/ugmi).flags !== "gimu"');
		}
		if (has(RegExp.prototype, 'dotAll')) {
			st.equal(getRegexLiteral('/a/sgmi').flags, 'gims', '(/a/sgmi).flags !== "gims"');
		}
		st.end();
	});

	t.test('has the correct descriptor', function (st) {
		st.equal(descriptor.configurable, true);
		st.equal(descriptor.enumerable, false);
		st.equal(typeof descriptor.get, 'function');
		st.equal(descriptor.set, undefined);
		st.end();
	});

	t.test('throws properly', function (st) {
		var nonObjects = ['', false, true, 42, NaN, null, undefined];
		st.plan(nonObjects.length);
		var throwsOnNonObject = function (nonObject) {
			st['throws'](testGenericFlags.bind(null, nonObject), TypeError);
		};
		nonObjects.forEach(throwsOnNonObject);
	});

	t.test('generic flags', function (st) {
		st.equal(testGenericFlags({}), '');
		st.equal(testGenericFlags({ ignoreCase: true }), 'i');
		st.equal(testGenericFlags({ dotAll: 1, global: 0, sticky: 1, unicode: 1 }), 'suy');
		st.equal(testGenericFlags({ __proto__: { multiline: true } }), 'm');
		st.end();
	});

	t.end();
});
