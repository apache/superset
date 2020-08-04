var test = require('tap').test;
var browserify = require('browserify');

var vm = require('vm');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(__dirname + '/files/robot.html', 'utf8');

test('hoisted fs declaration', function (t) {
    t.plan(1);
    
    var b = browserify();
    b.add(__dirname + '/files/hoist.js');
    b.transform(path.dirname(__dirname));
    
    b.bundle(function (err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, { console: { log: log } });
    });
    
    function log (msg) {
        t.equal(html, msg);
    }
});
