require('../../modules/es.date.to-primitive');
var toPrimitive = require('../../internals/date-to-primitive');

module.exports = function (it, hint) {
  return toPrimitive.call(it, hint);
};
