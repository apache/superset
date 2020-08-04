var browserify = require('browserify');
var test = require('tap').test;

var path = require('path');
var vm = require('vm');
var fs = require('fs');

test('readdir', function(t) {
    t.plan(1);

    var expected = fs.readdirSync(__dirname + '/files');
    var b = browserify(__dirname + '/files/readdir.js');
    b.transform(path.dirname(__dirname));
    b.bundle(function(err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, {
            console: { log: log },
            setTimeout: setTimeout,
            clearTimeout: clearTimeout
        });
    });

    function log(actual) {
        t.deepEqual(expected, actual);
    }
});

test('readdirSync', function(t) {
    t.plan(1);

    var expected = fs.readdirSync(__dirname + '/files');
    var b = browserify(__dirname + '/files/readdir-sync.js');
    b.transform(path.dirname(__dirname));
    b.bundle(function(err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, {
            console: { log: log }
        });
    });

    function log(actual) {
        t.deepEqual(expected, actual);
    }
});
