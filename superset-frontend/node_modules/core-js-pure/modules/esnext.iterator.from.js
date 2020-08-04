// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var path = require('../internals/path');
var aFunction = require('../internals/a-function');
var anObject = require('../internals/an-object');
var toObject = require('../internals/to-object');
var createIteratorProxy = require('../internals/iterator-create-proxy');
var getIteratorMethod = require('../internals/get-iterator-method');

var Iterator = path.Iterator;

var IteratorProxy = createIteratorProxy(function (arg) {
  var result = anObject(this.next.call(this.iterator, arg));
  var done = this.done = !!result.done;
  if (!done) return result.value;
}, true);

$({ target: 'Iterator', stat: true }, {
  from: function from(O) {
    var object = toObject(O);
    var usingIterator = getIteratorMethod(object);
    var iterator;
    if (usingIterator != null) {
      iterator = aFunction(usingIterator).call(object);
      if (iterator instanceof Iterator) return iterator;
    } else {
      iterator = object;
    } return new IteratorProxy({
      iterator: iterator
    });
  }
});
