'use strict';
var $ = require('../internals/export');
var charAt = require('../internals/string-multibyte').charAt;

// `String.prototype.at` method
// https://github.com/mathiasbynens/String.prototype.at
$({ target: 'String', proto: true }, {
  at: function at(pos) {
    return charAt(this, pos);
  }
});
