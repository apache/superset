var staticModule = require('static-module');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');
var resolve = require('resolve');

module.exports = function (file, opts) {
    if (/\.json$/.test(file)) return through();
    
    function resolver (p) {
        return resolve.sync(p, { basedir: path.dirname(file) });
    }
    var vars = {
        __filename: file,
        __dirname: path.dirname(file),
        require: { resolve: resolver }
    };
    if (!opts) opts = {};
    if (opts.vars) Object.keys(opts.vars).forEach(function (key) {
        vars[key] = opts.vars[key];
    });
    
    var sm = staticModule(
        {
            fs: {
                readFileSync: readFileSync,
                readFile: readFile,
                readdirSync: readdirSync,
                readdir: readdir
            }
        },
        {
            vars: vars,
            varModules: { path: path },
            parserOpts: opts && opts.parserOpts,
            sourceMap: opts && (opts.sourceMap || opts._flags && opts._flags.debug)
        }
    );
    return sm;
    
    function readFile (file, enc, cb) {
        if (typeof enc === 'function') {
            cb = enc;
            enc = null;
        }
        if (enc && typeof enc === 'object' && enc.encoding) {
            enc = enc.encoding;
        }
        var isBuffer = false;
        if (enc === null || enc === undefined) {
            isBuffer = true;
            enc = 'base64';
        }
        
        var stream = through(write, end);
        stream.push('process.nextTick(function(){(' + cb + ')(null,');
        if (isBuffer) stream.push('Buffer(');
        
        var s = fs.createReadStream(file, { encoding: enc });
        s.on('error', function (err) { sm.emit('error', err) });
        return s.pipe(quote()).pipe(stream);
        
        function write (buf, enc, next) {
            this.push(buf);
            next();
        }
        function end (next) {
            if (isBuffer) this.push(',"base64")');
            this.push(')})');
            this.push(null);
            sm.emit('file', file);
            next()
        }
    }
    
    function readFileSync (file, enc) {
        var isBuffer = false;
        if (enc === null || enc === undefined) {
            isBuffer = true;
            enc = 'base64';
        }
        if (enc && typeof enc === 'object' && enc.encoding) {
            enc = enc.encoding;
        }
        var stream = fs.createReadStream(file,  { encoding: enc })
            .on('error', function (err) { sm.emit('error', err) })
            .pipe(quote()).pipe(through(write, end))
        ;
        if (isBuffer) {
            stream.push('Buffer(');
        }
        return stream;
        
        function write (buf, enc, next) {
            this.push(buf);
            next();
        }
        function end (next) {
            if (isBuffer) this.push(',"base64")');
            this.push(null);
            sm.emit('file', file);
            next();
        }
    }
    
    function readdir(path, cb) {
        var stream = through(write, end);

        stream.push('process.nextTick(function(){(' + cb + ')(null,');
        fs.readdir(path, function (err, src) {
            if (err) {
                stream.emit('error', err);
                return;
            }
            stream.push(JSON.stringify(src));
            stream.end(')})');
        });
        return stream;

        function write (buf, enc, next) {
            this.push(buf);
            next();
        }
        function end (next) {
            this.push(null);
            next();
        }
    }

    function readdirSync (path) {
        var stream = through(write, end);
        fs.readdir(path, function (err, src) {
            if (err) {
                stream.emit('error', err);
                return;
            }
            stream.end(JSON.stringify(src));
        });
        return stream;

        function write (buf, enc, next) {
            this.push(buf);
            next();
        }
        function end (next) {
            this.push(null);
            next();
        }
    }
};
