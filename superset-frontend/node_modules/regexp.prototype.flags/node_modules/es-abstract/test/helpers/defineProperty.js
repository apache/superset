'use strict';

var oDP = Object.defineProperty;
try {
	oDP({}, 'a', { value: 1 });
} catch (e) {
	// IE 8
	oDP = null;
}

module.exports = function defineProperty(O, P, Desc) {
	if (oDP) {
		return oDP(O, P, Desc);
	}
	if ((Desc.enumerable && Desc.configurable && Desc.writable) || !(P in O)) {
		O[P] = Desc.value; // eslint-disable-line no-param-reassign
		return O;
	}

	throw new SyntaxError('helper does not yet support this configuration');
};
module.exports.oDP = oDP;
