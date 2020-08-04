require('../../modules/es.object.lookup-setter');
var entryUnbind = require('../../internals/entry-unbind');

module.exports = entryUnbind('Object', '__lookupGetter__');
