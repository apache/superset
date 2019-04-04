var test = require('tap').test;
var browserify = require('browserify');
var through = require('through');

var vm = require('vm');
var fs = require('fs');
var path = require('path');

test('parse non-js, non-json files', function (t) {
    t.plan(2);
    
    var b = browserify();
    b.add(__dirname + '/files/tr.beep');
    b.transform(function (file) {
        var buffers = [];
        if (!/\.beep$/.test(file)) return through();
        return through(write, end);
        
        function write (buf) { buffers.push(buf) }
        function end () {
            var src = Buffer.concat(buffers).toString('utf8');
            this.queue(src.replace(/\bFN\b/g, 'function'));
            this.queue(null);
        }
    });
    b.transform(path.dirname(__dirname));
    
    var bs = b.bundle(function (err, src) {
        if (err) t.fail(err);
        vm.runInNewContext(src, { console: { log: log } });
    });
    b.on('transform', function (tr) {
        tr.on('file', function (file) {
            t.equal(file, __dirname + '/files/tr.html');
        });
    });
    
    function log (msg) {
        t.equal(13, msg);
    }
});
