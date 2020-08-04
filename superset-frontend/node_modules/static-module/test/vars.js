var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('multi-vars', function (t) {
    t.plan(2);
    
    var expected = [ 'beep boop!' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'vars') } });
    
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(
            body.toString('utf8').replace(/;/g,''),
            'var html = "beep boop",\n  x = \'!\'\nconsole.log(html + x)\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('2-var', function (t) {
    t.plan(2);
    
    var expected = [ 'beep boop' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'vars') } });
    
    readStream('one.js').pipe(sm).pipe(concat(function (body) {
        t.equal(
            body.toString('utf8').replace(/;/g,''),
            'var html = "beep boop"\nconsole.log(html)\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('5-var', function (t) {
    t.plan(1);
    
    var expected = [ 'beep boop123' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'vars') } });
    
    readStream('five.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('multi consecutive require vars', function (t) {
    t.plan(1);
    
    var expected = [ 'beep boop' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, {
        vars: { __dirname: path.join(__dirname, 'vars') },
        sourceMap: true // Make sure source maps work when replacing 0 length ranges.
    });
    
    readStream('multi-require.js').pipe(sm).pipe(concat(function (body) {
        Function(['console','require'],body)({ log: log }, function() { return {} });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'vars', file));
}
