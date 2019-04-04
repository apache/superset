var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('inline object', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: { f: function (n) { return n * 111 } }
    });
    readStream('obj.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 555) }
    }));
});

test('inline object call', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: { f: function (n) { return n * 111 } }
    });
    readStream('obj_call.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 555) }
    }));
});

test('inline object expression', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: { f: function (n) { return n * 111 } }
    });
    readStream('obj_expr.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 1110) }
    }));
});

test('inline function', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: function (n) { return n * 111 }
    });
    readStream('fn.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 555) }
    }));
});

test('inline function call', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: function (n) { return n * 111 }
    });
    readStream('fn_call.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 555) }
    }));
});

test('inline function expression', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: function (n) { return n * 111 }
    });
    readStream('fn_expr.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 1665) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'inline', file));
}
