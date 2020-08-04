var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

test('readFileSync', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync empty', function (t) {
    t.plan(1);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('empty.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'), '');
    }));
});

test('readFileSync attribute', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('attribute.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync attribute with multiple vars', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('attribute_vars.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var x = 5, y = 2;'
            + '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync attribute with multiple require vars', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('multi_require.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var x = 5;'
            + '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync attribute with multiple require vars including an uninitalized var', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('multi_require_with_uninitialized.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var x;'
            + '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync attribute with multiple require vars x5', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('x5.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8').replace(/;/g,''),
            'var a = 1, b = 2, c = 3, d = 4, '
            + 'src = "beep boop\\n",\n'
            + '  e = 5\n'
            + 'console.log(src)\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync with bracket notation', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('brackets.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('readFileSync attribute bracket notation', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: {
            readFileSync: function (file) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('attribute_brackets.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            '\nvar src = "beep boop\\n";'
            + '\nconsole.log(src);\n'
        );
        vm.runInNewContext(body.toString('utf8'), {
            console: { log: log }
        });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'brfs', file));
}
