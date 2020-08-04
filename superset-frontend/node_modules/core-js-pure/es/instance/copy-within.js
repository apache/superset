var copyWithin = require('../array/virtual/copy-within');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.copyWithin;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.copyWithin) ? copyWithin : own;
};
