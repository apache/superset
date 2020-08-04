var values = require('../array/virtual/values');

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.values;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.values) ? values : own;
};
