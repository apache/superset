'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var anObject = require('../internals/an-object');
var createAsyncIteratorProxy = require('../internals/async-iterator-create-proxy');

var AsyncIteratorProxy = createAsyncIteratorProxy(function (arg, Promise) {
  var state = this;
  var iterator = state.iterator;

  return Promise.resolve(anObject(state.next.call(iterator, arg))).then(function (step) {
    if (anObject(step).done) {
      state.done = true;
      return { done: true, value: undefined };
    }
    return { done: false, value: [state.index++, step.value] };
  });
});

$({ target: 'AsyncIterator', proto: true, real: true }, {
  asIndexedPairs: function asIndexedPairs() {
    return new AsyncIteratorProxy({
      iterator: anObject(this),
      index: 0
    });
  }
});
