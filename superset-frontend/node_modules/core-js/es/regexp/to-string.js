require('../../modules/es.regexp.to-string');

module.exports = function toString(it) {
  return RegExp.prototype.toString.call(it);
};
