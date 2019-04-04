var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');
var resolve = require('resolve');

test('readFileSync of require.resolve()', function (t) {
    t.plan(1);
    var dir = __dirname + '/readfile_resolve';
    function rres (p) { return resolve.sync(p, { basedir: dir }) }
    
    var vars = {
        __dirname: dir,
        require: { resolve: rres }
    };
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: vars });
    readStream('main.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 'amaze\n') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'readfile_resolve', file));
}

function readFileSync (file, opts) {
    return fs.createReadStream(file).pipe(quote());
}
