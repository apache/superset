var test = require('tap').test;
var browserify = require('browserify');

var vm = require('vm');
var fs = require('fs');
var path = require('path');

test('skip parsing json', function (t) {
    t.plan(1);
    
    var b = browserify();
    b.add(__dirname + '/files/ag.js');
    b.transform(path.dirname(__dirname));
    
    b.bundle(function (err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, { console: { log: log } });
    });
    
    function log (msg) {
        t.equal('<h1>abcdefg</h1>\n', msg);
    }
});
