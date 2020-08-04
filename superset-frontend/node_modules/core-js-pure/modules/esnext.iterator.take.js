'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var anObject = require('../internals/an-object');
var toPositiveInteger = require('../internals/to-positive-integer');
var createIteratorProxy = require('../internals/iterator-create-proxy');

var IteratorProxy = createIteratorProxy(function (arg) {
  if (!this.remaining--) {
    this.done = true;
    return;
  }
  var result = anObject(this.next.call(this.iterator, arg));
  var done = this.done = !!result.done;
  if (!done) return result.value;
});

$({ target: 'Iterator', proto: true, real: true }, {
  take: function take(limit) {
    return new IteratorProxy({
      iterator: anObject(this),
      remaining: toPositiveInteger(limit)
    });
  }
});
