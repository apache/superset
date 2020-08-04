var test = require('tap').test;
var exec = require('child_process').exec;

var browserify = require('browserify');
var path = require('path');
var vm = require('vm');
var fs = require('fs');

var text = fs.readFileSync(__dirname + '/files/separators.txt', 'utf8');

test('run file with special unicode separators', function (t) {
  t.plan(1);
  exec(__dirname + '/../bin/cmd.js ' + __dirname + '/files/separators.js',
    function (error, stdout, stderr) {
      if (error !== null) {
        t.fail();
      } else {
        vm.runInNewContext(stdout, {
          require: function () {},
          console: { log: log }
        });
        function log (msg) {
          t.equal(text, msg);
        };
      };
    }
  );
});

test('bundle file with special unicode separators', function (t) {
    t.plan(1);

    var b = browserify();
    b.add(__dirname + '/files/separators.js');
    b.transform(path.dirname(__dirname));

    b.bundle(function (err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, { console: { log: log } });
    });

    function log (msg) {
        t.equal(text, msg);
    }
});
