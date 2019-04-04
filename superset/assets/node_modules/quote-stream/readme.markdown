# quote-stream

transform a stream into a quoted string

[![testling badge](https://ci.testling.com/substack/quote-stream.png)](https://ci.testling.com/substack/quote-stream)

[![build status](https://secure.travis-ci.org/substack/quote-stream.png)](http://travis-ci.org/substack/quote-stream)

# example

``` js
var quote = require('quote-stream');
process.stdin.pipe(quote()).pipe(process.stdout);
```

output:

```
$ echo beep boop | node example/stream.js
"beep boop\n"
```

# methods

``` js
var quote = require('quote-stream')
```

## var q = quote()

Return a transform stream `q` that wraps input in double quotes and adds escape
characters to the chunks.

# usage

```
usage: quote-stream

  Transform stdin to a quoted string on stdout.

```

# install

With [npm](https://npmjs.org) do:

```
npm install quote-stream
```

# license

MIT
