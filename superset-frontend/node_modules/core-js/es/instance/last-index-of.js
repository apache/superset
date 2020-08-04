var lastIndexOf = require('../array/virtual/last-index-of');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.lastIndexOf;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.lastIndexOf) ? lastIndexOf : own;
};
