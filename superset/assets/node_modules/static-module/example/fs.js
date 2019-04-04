var staticModule = require('../');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');

var sm = staticModule({
    fs: {
        readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        },
        readFile: function (file, cb) {
            var stream = through(write, end);
            stream.push('process.nextTick(function(){(' + cb + ')(null,');
            return fs.createReadStream(file).pipe(quote()).pipe(stream);
            
            function write (buf, enc, next) { this.push(buf); next() }
            function end (next) { this.push(')})'); this.push(null); next() }
        }
    }
}, { vars: { __dirname: __dirname + '/fs' } });
process.stdin.pipe(sm).pipe(process.stdout);
