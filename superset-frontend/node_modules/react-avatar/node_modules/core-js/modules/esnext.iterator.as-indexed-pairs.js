'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var anObject = require('../internals/an-object');
var createIteratorProxy = require('../internals/iterator-create-proxy');

var IteratorProxy = createIteratorProxy(function (arg) {
  var result = anObject(this.next.call(this.iterator, arg));
  var done = this.done = !!result.done;
  if (!done) return [this.index++, result.value];
});

$({ target: 'Iterator', proto: true, real: true }, {
  asIndexedPairs: function asIndexedPairs() {
    return new IteratorProxy({
      iterator: anObject(this),
      index: 0
    });
  }
});
