var _getIterator = require("../core-js/get-iterator");

var _isIterable = require("../core-js/is-iterable");

function _iterableToArrayLimitLoose(arr, i) {
  if (!(_isIterable(Object(arr)) || Object.prototype.toString.call(arr) === "[object Arguments]")) {
    return;
  }

  var _arr = [];

  for (var _iterator = _getIterator(arr), _step; !(_step = _iterator.next()).done;) {
    _arr.push(_step.value);

    if (i && _arr.length === i) break;
  }

  return _arr;
}

module.exports = _iterableToArrayLimitLoose;