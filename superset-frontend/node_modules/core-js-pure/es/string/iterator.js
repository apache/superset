require('../../modules/es.string.iterator');
var Iterators = require('../../internals/iterators');

var getStringIterator = Iterators.String;

module.exports = function (it) {
  return getStringIterator.call(it);
};
