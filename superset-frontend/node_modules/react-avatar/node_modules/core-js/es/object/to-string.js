require('../../modules/es.object.to-string');
require('../../modules/es.math.to-string-tag');
require('../../modules/es.json.to-string-tag');
var classof = require('../../internals/classof');

module.exports = function (it) {
  return '[object ' + classof(it) + ']';
};
