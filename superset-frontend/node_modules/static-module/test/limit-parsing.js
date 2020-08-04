var concat = require('concat-stream');
var from = require('from2-string');
var staticModule = require('../');
var test = require('tape');

test('limit parsing to files including a target module', function (t) {
  var passInput = 'THIS WILL NOT PARSE';
  var failInput = passInput + '; require("fs")';

  t.plan(2);

  from(passInput)
    .pipe(staticModule({ fs: require('fs') }))
    .pipe(concat(function (passOutput) {
      t.equal(passInput, String(passOutput), 'does not parse');
    }));

  from(failInput)
    .pipe(staticModule({ fs: require('fs') }))
    .once('error', function () {
      t.pass('parses if module is included');
    });
});
