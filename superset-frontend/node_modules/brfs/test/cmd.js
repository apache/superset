var test = require('tap').test;
var exec = require('child_process').exec;

var vm = require('vm');
var fs = require('fs');

var html = fs.readFileSync(__dirname + '/files/robot.html', 'utf8');

test('cmd.js', function (t) {
  t.plan(1);
  exec(__dirname + '/../bin/cmd.js ' + __dirname + '/files/main.js',
    function (error, stdout, stderr) {
      if (error !== null) {
        t.fail();
      } else {
        vm.runInNewContext(stdout, { 
          require: function () {},
          console: { log: log }
        });
        function log (msg) {
          t.equal(html, msg);
        };
      };
    }
  );
});