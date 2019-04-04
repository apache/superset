# static-eval

evaluate statically-analyzable expressions

[![testling badge](https://ci.testling.com/substack/static-eval.png)](https://ci.testling.com/substack/static-eval)

[![build status](https://secure.travis-ci.org/substack/static-eval.png)](http://travis-ci.org/substack/static-eval)

# security

static-eval is like `eval`. It is intended for use in build scripts and code transformations, doing some evaluation at build time—it is **NOT** suitable for handling arbitrary untrusted user input. Malicious user input _can_ execute arbitrary code.

# example

``` js
var evaluate = require('static-eval');
var parse = require('esprima').parse;

var src = process.argv[2];
var ast = parse(src).body[0].expression;

console.log(evaluate(ast));
```

If you stick to simple expressions, the result is statically analyzable:

```
$ node '7*8+9'
65
$ node eval.js '[1,2,3+4*5-(5*11)]'
[ 1, 2, -32 ]
```

but if you use statements, undeclared identifiers, or syntax, the result is no
longer statically analyzable and `evaluate()` returns `undefined`:

```
$ node eval.js '1+2+3*n'
undefined
$ node eval.js 'x=5; x*2'
undefined
$ node eval.js '5-4*3'
-7
```

You can also declare variables and functions to use in the static evaluation:

``` js
var evaluate = require('static-eval');
var parse = require('esprima').parse;

var src = '[1,2,3+4*10+n,foo(3+5),obj[""+"x"].y]';
var ast = parse(src).body[0].expression;

console.log(evaluate(ast, {
    n: 6,
    foo: function (x) { return x * 100 },
    obj: { x: { y: 555 } }
}));
```

# methods

``` js
var evaluate = require('static-eval');
```

## evaluate(ast, vars={})

Evaluate the [esprima](https://npmjs.org/package/esprima)-parsed abstract syntax
tree object `ast` with an optional collection of variables `vars` to use in the
static expression resolution.

If the expression contained in `ast` can't be statically resolved, `evaluate()`
returns undefined.

# install

With [npm](https://npmjs.org) do:

```
npm install static-eval
```

# license

MIT
