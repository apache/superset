var entries = require('../array/virtual/entries');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.entries;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.entries) ? entries : own;
};
