require('../../modules/es.regexp.flags');
var flags = require('../../internals/regexp-flags');

module.exports = function (it) {
  return flags.call(it);
};
