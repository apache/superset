var test = require('tap').test;
var browserify = require('browserify');

var vm = require('vm');
var path = require('path');

test('sync string encoding', function (t) {
    t.plan(1);
    var b = browserify(__dirname + '/files/encoding.js');
    b.transform(path.dirname(__dirname));
    b.bundle(function (err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, {
            setTimeout: setTimeout,
            console: { log: log }
        });
    });
    function log (msg) { t.equal(msg, '3c623e6265657020626f6f703c2f623e0a') }
});
