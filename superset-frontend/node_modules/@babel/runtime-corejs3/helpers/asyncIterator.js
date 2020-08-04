var _getIteratorMethod = require("../core-js/get-iterator-method");

var _Symbol$iterator = require("../core-js/symbol/iterator");

var _Symbol$asyncIterator = require("../core-js/symbol/async-iterator");

var _Symbol = require("../core-js/symbol");

function _asyncIterator(iterable) {
  var method;

  if (typeof _Symbol !== "undefined") {
    if (_Symbol$asyncIterator) {
      method = iterable[_Symbol$asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (_Symbol$iterator) {
      method = _getIteratorMethod(iterable);
      if (method != null) return method.call(iterable);
    }
  }

  throw new TypeError("Object is not async iterable");
}

module.exports = _asyncIterator;