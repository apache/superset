'use strict';
var $ = require('../internals/export');
var requireObjectCoercible = require('../internals/require-object-coercible');
var isRegExp = require('../internals/is-regexp');
var getRegExpFlags = require('../internals/regexp-flags');
var wellKnownSymbol = require('../internals/well-known-symbol');
var IS_PURE = require('../internals/is-pure');

var REPLACE = wellKnownSymbol('replace');
var RegExpPrototype = RegExp.prototype;

// `String.prototype.replaceAll` method
// https://github.com/tc39/proposal-string-replace-all
$({ target: 'String', proto: true }, {
  replaceAll: function replaceAll(searchValue, replaceValue) {
    var O = requireObjectCoercible(this);
    var IS_REG_EXP, flags, replacer, string, searchString, template, result, position, index;
    if (searchValue != null) {
      IS_REG_EXP = isRegExp(searchValue);
      if (IS_REG_EXP) {
        flags = String(requireObjectCoercible('flags' in RegExpPrototype
          ? searchValue.flags
          : getRegExpFlags.call(searchValue)
        ));
        if (!~flags.indexOf('g')) throw TypeError('`.replaceAll` does not allow non-global regexes');
      }
      replacer = searchValue[REPLACE];
      if (replacer !== undefined) {
        return replacer.call(searchValue, O, replaceValue);
      } else if (IS_PURE && IS_REG_EXP) {
        return String(O).replace(searchValue, replaceValue);
      }
    }
    string = String(O);
    searchString = String(searchValue);
    if (searchString === '') return replaceAll.call(string, /(?:)/g, replaceValue);
    template = string.split(searchString);
    if (typeof replaceValue !== 'function') {
      return template.join(String(replaceValue));
    }
    result = template[0];
    position = result.length;
    for (index = 1; index < template.length; index++) {
      result += String(replaceValue(searchString, position, string));
      position += searchString.length + template[index].length;
      result += template[index];
    }
    return result;
  }
});
