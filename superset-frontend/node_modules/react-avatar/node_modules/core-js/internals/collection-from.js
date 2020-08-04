'use strict';
// https://tc39.github.io/proposal-setmap-offrom/
var aFunction = require('../internals/a-function');
var bind = require('../internals/function-bind-context');
var iterate = require('../internals/iterate');

module.exports = function from(source /* , mapFn, thisArg */) {
  var length = arguments.length;
  var mapFn = length > 1 ? arguments[1] : undefined;
  var mapping, A, n, boundFunction;
  aFunction(this);
  mapping = mapFn !== undefined;
  if (mapping) aFunction(mapFn);
  if (source == undefined) return new this();
  A = [];
  if (mapping) {
    n = 0;
    boundFunction = bind(mapFn, length > 2 ? arguments[2] : undefined, 2);
    iterate(source, function (nextItem) {
      A.push(boundFunction(nextItem, n++));
    });
  } else {
    iterate(source, A.push, A);
  }
  return new this(A);
};
