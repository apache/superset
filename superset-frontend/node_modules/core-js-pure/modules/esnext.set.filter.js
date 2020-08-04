'use strict';
var $ = require('../internals/export');
var IS_PURE = require('../internals/is-pure');
var getBuiltIn = require('../internals/get-built-in');
var anObject = require('../internals/an-object');
var aFunction = require('../internals/a-function');
var bind = require('../internals/function-bind-context');
var speciesConstructor = require('../internals/species-constructor');
var getSetIterator = require('../internals/get-set-iterator');
var iterate = require('../internals/iterate');

// `Set.prototype.filter` method
// https://github.com/tc39/proposal-collection-methods
$({ target: 'Set', proto: true, real: true, forced: IS_PURE }, {
  filter: function filter(callbackfn /* , thisArg */) {
    var set = anObject(this);
    var iterator = getSetIterator(set);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3);
    var newSet = new (speciesConstructor(set, getBuiltIn('Set')))();
    var adder = aFunction(newSet.add);
    iterate(iterator, function (value) {
      if (boundFunction(value, value, set)) adder.call(newSet, value);
    }, undefined, false, true);
    return newSet;
  }
});
