var flat = require('../array/virtual/flat');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.flat;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.flat) ? flat : own;
};
