var keys = require('../array/virtual/keys');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.keys;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.keys) ? keys : own;
};
