require('../../modules/es.regexp.exec');
require('../../modules/es.regexp.test');

module.exports = function (re, string) {
  return RegExp.prototype.test.call(re, string);
};
