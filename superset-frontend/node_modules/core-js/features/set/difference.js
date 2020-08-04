require('../../modules/es.set');
require('../../modules/es.string.iterator');
require('../../modules/esnext.set.difference');
require('../../modules/web.dom-collections.iterator');
var entryUnbind = require('../../internals/entry-unbind');

module.exports = entryUnbind('Set', 'difference');
