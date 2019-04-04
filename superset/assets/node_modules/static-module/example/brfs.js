var staticModule = require('../');
var quote = require('quote-stream');
var fs = require('fs');

var sm = staticModule({
    fs: {
        readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        }
    }
}, { vars: { __dirname: __dirname + '/brfs' } });
process.stdin.pipe(sm).pipe(process.stdout);
