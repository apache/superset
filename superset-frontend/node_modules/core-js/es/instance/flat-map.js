var flatMap = require('../array/virtual/flat-map');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.flatMap;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.flatMap) ? flatMap : own;
};
