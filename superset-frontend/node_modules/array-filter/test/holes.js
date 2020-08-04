var filter = require('..');
var test = require('tape');

test('skip over holes', function(t) {
  var arr = new Array(5);
  arr.filter = undefined;
  var res = filter(arr, function(el) {
    return false;
  });
  t.deepEqual(res, []);
  t.end();
});
