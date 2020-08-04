require('../../modules/es.object.to-string');
require('../../modules/es.promise');
require('../../modules/es.string.iterator');
require('../../modules/esnext.async-iterator.constructor');
require('../../modules/esnext.async-iterator.flat-map');
require('../../modules/web.dom-collections.iterator');

var entryUnbind = require('../../internals/entry-unbind');

module.exports = entryUnbind('AsyncIterator', 'flatMap');
