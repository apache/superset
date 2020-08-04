'use strict';
var $ = require('../internals/export');
var toObject = require('../internals/to-object');
var toPrimitive = require('../internals/to-primitive');
var toISOString = require('../internals/date-to-iso-string');
var classof = require('../internals/classof-raw');
var fails = require('../internals/fails');

var FORCED = fails(function () {
  return new Date(NaN).toJSON() !== null
    || Date.prototype.toJSON.call({ toISOString: function () { return 1; } }) !== 1;
});

$({ target: 'Date', proto: true, forced: FORCED }, {
  // eslint-disable-next-line no-unused-vars
  toJSON: function toJSON(key) {
    var O = toObject(this);
    var pv = toPrimitive(O);
    return typeof pv == 'number' && !isFinite(pv) ? null :
      (!('toISOString' in O) && classof(O) == 'Date') ? toISOString.call(O) : O.toISOString();
  }
});
