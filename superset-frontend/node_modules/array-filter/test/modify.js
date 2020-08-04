var filter = require('..');
var test = require('tape');

test('modify', function(t) {
  var arr = ['foo'];
  arr.filter = undefined;
  var mod = filter(arr, function(el, i, arr) {
    arr[i] = 'bar';
    return true;
  });
  t.deepEqual(mod, ['foo']);
  t.end();
});
