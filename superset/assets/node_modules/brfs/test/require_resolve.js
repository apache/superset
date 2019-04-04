var test = require('tap').test;
var browserify = require('browserify');

var vm = require('vm');
var fs = require('fs');
var path = require('path');

test('require.resolve', function (t) {
    t.plan(2);
    
    var b = browserify();
    b.add(__dirname + '/require_resolve/main.js');
    b.transform(path.dirname(__dirname));
    
    b.bundle(function (err, src) {
        t.ifError(err);
        vm.runInNewContext(src, { console: { log: log } });
    });
    
    function log (msg) { t.equal(msg, 'amaze\n') }
});
