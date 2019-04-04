# x256

return the nearest
[xterm 256 color code](http://www.frexx.de/xterm-256-notes/)
for rgb inputs.

[![testling badge](https://ci.testling.com/substack/node-x256.png)](https://ci.testling.com/substack/node-x256)

[![build status](https://secure.travis-ci.org/substack/node-x256.png)](http://travis-ci.org/substack/node-x256)

# example

You can just print the index:

``` js
var x256 = require('x256');
var ix = x256(220,40,150);
console.log(ix);
```

output:

```
162
```

or you can use raw ansi escape codes:

``` js
var x256 = require('x256');
var ix = x256(220,40,150);
console.log('\x1b[38;5;' + ix + 'mBEEEEEP');
```

output:

![x256 raw beep](http://substack.net/images/screenshots/x256_raw_beep.png)

or you can use [charm](https://github.com/substack/node-charm):

``` js
var x256 = require('x256');
var charm = require('charm')(process.stdout);

var ix = x256(220,40,150);
charm.foreground(ix).write('beep boop');
```

output:

![x256 charm beep boop](http://substack.net/images/screenshots/x256_charm_beep_boop.png)

# methods

```
var x256 = require('x256')
```

## x256(red, green, blue)

Return the nearest xterm 256 color code for the 24-bit `[red, green, blue]`
values.

`red`, `green`, and `blue` should each be integers from 0 through 255,
inclusive.

# attributes

## x256.colors

array of `[red,green,blue]` 24-bit color arrays indexed by xterm 256 color code

# install

With [npm](http://npmjs.org) do:

```
npm install x256
```

# license

MIT
