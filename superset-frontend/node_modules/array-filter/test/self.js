var filter = require('..');
var test = require('tape');

test('self', function(t) {
  var arr = [1];
  arr.filter = undefined;
  var self = {};
  filter(arr, function(el) {
    t.equal(this, self);
    t.end();
  }, self);
});
