'use strict';

var test = require('tape');
var debug = require('object-inspect');
var forEach = require('foreach');

var v = require('./values');
var getSymbolDescription = require('../../helpers/getSymbolDescription');
var getInferredName = require('../../helpers/getInferredName');

test('getSymbolDescription', function (t) {
	t.test('no symbols', { skip: v.hasSymbols }, function (st) {
		st['throws'](
			getSymbolDescription,
			SyntaxError,
			'requires Symbol support'
		);

		st.end();
	});

	forEach(v.nonSymbolPrimitives.concat(v.objects), function (nonSymbol) {
		t['throws'](
			function () { getSymbolDescription(nonSymbol); },
			v.hasSymbols ? TypeError : SyntaxError,
			debug(nonSymbol) + ' is not a Symbol'
		);
	});

	t.test('with symbols', { skip: !v.hasSymbols }, function (st) {
		forEach(
			[
				[Symbol(), undefined],
				[Symbol(undefined), undefined],
				[Symbol(null), 'null'],
				[Symbol.iterator, 'Symbol.iterator'],
				[Symbol('foo'), 'foo']
			],
			function (pair) {
				var sym = pair[0];
				var desc = pair[1];
				st.equal(getSymbolDescription(sym), desc, debug(sym) + ' yields ' + debug(desc));
			}
		);

		st.test('only possible when inference is supported', { skip: !getInferredName }, function (s2t) {
			s2t.equal(getSymbolDescription(Symbol('')), '', 'Symbol("") description is empty string');
			s2t.end();
		});

		st.end();
	});

	t.end();
});
