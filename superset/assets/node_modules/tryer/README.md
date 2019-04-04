# tryer

[![Build status](https://gitlab.com/philbooth/tryer/badges/master/pipeline.svg)](https://gitlab.com/philbooth/tryer/pipelines)
[![Package status](https://img.shields.io/npm/v/tryer.svg)](https://www.npmjs.com/package/tryer)
[![Downloads](https://img.shields.io/npm/dm/tryer.svg)](https://www.npmjs.com/package/tryer)
[![License](https://img.shields.io/npm/l/tryer.svg)](https://opensource.org/licenses/MIT)


Because everyone loves a tryer!
Conditional
and repeated
function invocation
for node
and browser.

* [Say what?](#say-what)
* [What size is it?](#what-size-is-it)
* [How do I install it?](#how-do-i-install-it)
* [How do I use it?](#how-do-i-use-it)
  * [Loading the library](#loading-the-library)
  * [Calling the exported function](#calling-the-exported-function)
  * [Examples](#examples)
* [How do I set up the dev environment?](#how-do-i-set-up-the-dev-environment)
* [What license is it released under?](#what-license-is-it-released-under)

## Say what?

Sometimes,
you want to defer
calling a function
until a certain
pre-requisite condition is met.
Other times,
you want to
call a function
repeatedly
until some post-requisite condition
is satisfied.
Occasionally,
you might even want
to do both
for the same function.

To save you writing
explicit conditions
and loops
on each of those occasions,
`tryer` implements
a predicate-based approach
that hides the cruft
behind a simple,
functional interface.

Additionally,
it allows you to easily specify
retry intervals
and limits,
so that your code
doesn't hog the CPU.
It also supports
exponential backoff
of retry intervals,
which can be useful
when handling
indefinite error states
such as network failure.

## What size is it?

5.6 kb unminified with comments, 1.1 kb minified, 0.5 kb minified + gzipped.

## How do I install it?

Via npm:

```
npm i tryer --save
```

Or if you just want the git repo:

```
git clone git@gitlab.com:philbooth/tryer.git
```

## How do I use it?

### Loading the library

If you are running in
Node.js
or another CommonJS-style
environment,
you can `require`
tryer like so:

```javascript
const tryer = require('tryer');
```

It also the supports
the AMD-style format
preferred by Require.js.

If you are
including `tryer`
with an HTML `<script>` tag,
or neither of the above environments
are detected,
it will be exported globally as `tryer`.

### Calling the exported function

`tryer` is a function
that can be invoked to
call other functions
conditionally and repeatedly,
without the need for
explicit `if` statements
or loops in your own code.

`tryer` takes one argument,
an options object
that supports
the following properties:

* `action`:
  The function that you want to invoke.
  If `action` returns a promise,
  iterations will not end
  until the promise is resolved or rejected.
  Alternatively,
  `action` may take a callback argument, `done`,
  to signal that it is asynchronous.
  In that case,
  you are responsible
  for calling `done`
  when the action is finished.
  If `action` is not set,
  it defaults to an empty function.

* `when`:
  A predicate
  that tests the pre-condition
  for invoking `action`.
  Until `when` returns true
  (or a truthy value),
  `action` will not be called.
  Defaults to
  a function that immediately returns `true`.

* `until`:
  A predicate
  that tests the post-condition
  for invoking `action`.
  After `until` returns true
  (or a truthy value),
  `action` will no longer be called.
  Defaults to
  a function that immediately returns `true`.

* `fail`:
  The error handler.
  A function
  that will be called
  if `limit` falsey values
  are returned by `when` or `until`.
  Defaults to an empty function.

* `pass`:
  Success handler.
  A function
  that will be called
  after `until` has returned truthily.
  Defaults to an empty function.

* `limit`:
  Failure limit,
  representing the maximum number
  of falsey returns from `when` or `until`
  that will be permitted
  before invocation is deemed to have failed.
  A negative number
  indicates that the attempt
  should never fail,
  instead continuing 
  for as long as `when` and `until`
  have returned truthy values.
  Defaults to `-1`.

* `interval`:
  The retry interval,
  in milliseconds.
  A negative number indicates
  that each subsequent retry
  should wait for twice the interval
  from the preceding iteration
  (i.e. exponential backoff).
  The default value is `-1000`,
  signifying that
  the initial retry interval
  should be one second
  and that each subsequent attempt
  should wait for double the length
  of the previous interval.

### Examples

```javascript
// Attempt to insert a database record, waiting until `db.isConnected`
// before doing so. The retry interval is 1 second on each iteration
// and the call will fail after 10 attempts.
tryer({
  action: () => db.insert(record),
  when: () => db.isConnected,
  interval: 1000,
  limit: 10,
  fail () {
    log.error('No database connection, terminating.');
    process.exit(1);
  }
});
```

```javascript
// Attempt to send an email message, optionally retrying with
// exponential backoff starting at 1 second. Continue to make
// attempts indefinitely until the call succeeds.
let sent = false;
tryer({
  action (done) {
    smtp.send(email, error => {
      if (! error) {
        sent = true;
      }
      done();
    });
  },
  until: () => sent,
  interval: -1000,
  limit: -1
});
```

```javascript
// Poll a device at 30-second intervals, continuing indefinitely.
tryer({
  action: () => device.poll().then(response => handle(response)),
  interval: 30000,
  limit: -1
});
```

## How do I set up the dev environment?

The dev environment relies on
[Chai],
[JSHint],
[Mocha],
[please-release-me],
[spooks.js] and
[UglifyJS].
The source code is in
`src/tryer.js`
and the unit tests are in
`test/unit.js`.

To install the dependencies:

```
npm i
```

To run the tests:

```
npm t
```

To lint the code:

```
npm run lint
```

To regenerate the minified lib:

```
npm run minify
```

## What license is it released under?

[MIT](COPYING)

[chai]: http://chaijs.com/
[jshint]: http://jshint.com/
[mocha]: http://mochajs.org/
[please-release-me]: https://gitlab.com/philbooth/please-release-me
[spooks.js]: https://gitlab.com/philbooth/spooks.js
[uglifyjs]: http://lisperator.net/uglifyjs/
[license]: COPYING

