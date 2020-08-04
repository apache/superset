var test = require('tape');
var fs = require('fs');
var path = require('path');
var tmp = require('tmp');
var rollup = require('rollup');
var execSync = require('child_process').execSync;

var node = process.argv[0];
var fixtures = fs.readdirSync(path.join(__dirname, 'fixtures'));

fixtures.forEach(function (fixture) {
  test('module: ' + fixture, function (t) {
    t.plan(1);

    var filename = path.join(__dirname, 'fixtures', fixture);
    rollup.rollup({ entry: filename })
      .then(function (bundle) {
        var js = bundle.generate({ format: 'es' }).code;

        var tmpfile = tmp.fileSync().name;
        var command = `"${node}" ${tmpfile}`;
        fs.writeFileSync(tmpfile, js);
        var stdout = execSync(command).toString().trim();

        t.equal(stdout, '#ffebee');
      });
  });
});
