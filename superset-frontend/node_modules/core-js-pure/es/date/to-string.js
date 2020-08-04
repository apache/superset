require('../../modules/es.date.to-string');
var dateToString = Date.prototype.toString;

module.exports = function toString(it) {
  return dateToString.call(it);
};
