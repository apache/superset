var filter = require('..');
var test = require('tape');

test('typecheck', function(t) {
  var arr = [];
  arr.filter = undefined;
  
  t.throws(function() {
    filter(undefined, function(){});
  }, 'arr undefined');
  
  t.throws(function() {
    filter(null, function(){});
  }, 'arr null');
  
  t.throws(function() {
    filter(arr, {});
  }, 'fn wrong type');
  
  t.end();
});
