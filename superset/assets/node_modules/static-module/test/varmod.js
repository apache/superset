var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('variable modules', function (t) {
    t.plan(2);
    
    var expected = [ 'beep boop!' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, {
        vars: { __dirname: path.join(__dirname, 'vars') },
        varModules: { path: require('path') }
    });
    
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(
            body.toString('utf8'),
            '\nvar path = require(\'path\');'
            + '\nvar html = "beep boop";\nvar x = \'!\';'
            + '\nconsole.log(html + x);\n'
        );
        Function(['console','require'],body)({ log: log },require);
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'varmod', file));
}
