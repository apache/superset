// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var path = require('../internals/path');
var aFunction = require('../internals/a-function');
var anObject = require('../internals/an-object');
var toObject = require('../internals/to-object');
var createAsyncIteratorProxy = require('../internals/async-iterator-create-proxy');
var getAsyncIteratorMethod = require('../internals/get-async-iterator-method');

var AsyncIterator = path.AsyncIterator;

var AsyncIteratorProxy = createAsyncIteratorProxy(function (arg) {
  return anObject(this.next.call(this.iterator, arg));
}, true);

$({ target: 'AsyncIterator', stat: true }, {
  from: function from(O) {
    var object = toObject(O);
    var usingIterator = getAsyncIteratorMethod(object);
    var iterator;
    if (usingIterator != null) {
      iterator = aFunction(usingIterator).call(object);
      if (iterator instanceof AsyncIterator) return iterator;
    } else {
      iterator = object;
    } return new AsyncIteratorProxy({
      iterator: iterator
    });
  }
});
