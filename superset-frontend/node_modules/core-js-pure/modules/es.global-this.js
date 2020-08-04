var $ = require('../internals/export');
var global = require('../internals/global');

// `globalThis` object
// https://github.com/tc39/proposal-global
$({ global: true }, {
  globalThis: global
});
