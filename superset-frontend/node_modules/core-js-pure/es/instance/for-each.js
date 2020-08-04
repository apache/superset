var forEach = require('../array/virtual/for-each');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.forEach;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.forEach) ? forEach : own;
};
