# static-module

convert module usage to inline expressions

# example

Here's a simplified version of the [brfs](https://npmjs.org/package/brfs) module
using static-module.

brfs converts `fs.readFileSync(file)` calls to inline strings with the contents
of `file` included in-place.

``` js
var staticModule = require('static-module');
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
```

input:

```
$ cat brfs/source.js
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/x.txt');
console.log(src);
```

output:

```
$ node brfs.js < brfs/source.js 

var src = "beep boop\n";
console.log(src);
```

# methods

``` js
var staticModule = require('static-module')
```

## var sm = staticModule(modules, opts={})

Return a transform stream `sm` that transforms javascript source input to
javascript source output with each property in the `modules` object expanded in
inline form.

Properties in the `modules` object can be ordinary values that will be included
directly or functions that will be executed with the [statically
evaluated](https://npmjs.org/package/static-eval) arguments from the source
under an optional set of `opts.vars` variables.

Property functions can return streams, in which case their contents will be
piped directly into the source output.

Otherwise, the return values of functions will be inlined into the source in
place as strings.

Use `opts.varModules` to map whitelisted module names to definitions that can be
declared in client code with `var` and will appear in static expressions like
`opts.vars`.

For example, to make this code with `path.join()` work:

``` js
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(__dirname, 'x.txt'), 'utf8');
console.log(src);
```

you can do:

``` js
var staticModule = require('static-module');
var quote = require('quote-stream');
var fs = require('fs');

var sm = staticModule({
    fs: {
        readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        }
    },
    varMods: { path: require('path') }
}, { vars: { __dirname: __dirname + '/brfs' } });
process.stdin.pipe(sm).pipe(process.stdout);
```

Use `opts.parserOpts` to set additional options for the
[acorn](https://github.com/acornjs/acorn) parser.

Set `opts.sourceMap` to `true` to generate a source map and add it as an inline
comment. You can add `opts.inputFilename` to configure the original file name
that will be listed in the source map.

# install

With [npm](https://npmjs.org) do:

```
npm install static-module
```

# license

MIT
