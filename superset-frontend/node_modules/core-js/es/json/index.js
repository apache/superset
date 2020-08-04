require('../../modules/es.json.to-string-tag');
var path = require('../../internals/path');

module.exports = path.JSON || (path.JSON = { stringify: JSON.stringify });
