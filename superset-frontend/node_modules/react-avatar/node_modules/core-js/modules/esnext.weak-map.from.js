var $ = require('../internals/export');
var from = require('../internals/collection-from');

// `WeakMap.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.from
$({ target: 'WeakMap', stat: true }, {
  from: from
});
