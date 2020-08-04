'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var callBound = require('./callBound');

var $SyntaxError = GetIntrinsic('%SyntaxError%');
var symToStr = callBound('Symbol.prototype.toString', true);

var getInferredName = require('./getInferredName');

module.exports = function getSymbolDescription(symbol) {
	if (!symToStr) {
		throw new $SyntaxError('Symbols are not supported in this environment');
	}
	var str = symToStr(symbol); // will throw if not a symbol

	if (getInferredName) {
		var name = getInferredName(symbol);
		if (name === '') { return; }
		// eslint-disable-next-line consistent-return
		return name.slice(1, -1); // name.slice('['.length, -']'.length);
	}

	var desc = str.slice(7, -1); // str.slice('Symbol('.length, -')'.length);
	if (desc) {
		// eslint-disable-next-line consistent-return
		return desc;
	}
};
