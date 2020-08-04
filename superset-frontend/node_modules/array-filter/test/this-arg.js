var filter = require('..');
var test = require('tape');

test('thisArg', function(t) {
  var self = {};
  var arr = [1];
  arr.filter = undefined;
  filter(arr, function(el) {
    t.equal(this, self);
    t.end();
  }, self);
});

test('thisArg native', function(t) {
  var self = {};
  var arr = [1];
  filter(arr, function(el) {
    t.equal(this, self);
    t.end();
  }, self);
});
