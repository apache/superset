# randexp.js

randexp will generate a random string that matches a given RegExp Javascript object.

[![Build Status](https://secure.travis-ci.org/fent/randexp.js.svg)](http://travis-ci.org/fent/randexp.js)
[![Dependency Status](https://david-dm.org/fent/randexp.js.svg)](https://david-dm.org/fent/randexp.js)
[![codecov](https://codecov.io/gh/fent/randexp.js/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/randexp.js)

# Usage

```js
var RandExp = require('randexp');

// supports grouping and piping
new RandExp(/hello+ (world|to you)/).gen();
// => hellooooooooooooooooooo world

// sets and ranges and references
new RandExp(/<([a-z]\w{0,20})>foo<\1>/).gen();
// => <m5xhdg>foo<m5xhdg>

// wildcard
new RandExp(/random stuff: .+/).gen();
// => random stuff: l3m;Hf9XYbI [YPaxV>U*4-_F!WXQh9>;rH3i l!8.zoh?[utt1OWFQrE ^~8zEQm]~tK

// ignore case
new RandExp(/xxx xtreme dragon warrior xxx/i).gen();
// => xxx xtReME dRAGON warRiOR xXX

// dynamic regexp shortcut
new RandExp('(sun|mon|tue|wednes|thurs|fri|satur)day', 'i');
// is the same as
new RandExp(new RegExp('(sun|mon|tue|wednes|thurs|fri|satur)day', 'i'));
```

If you're only going to use `gen()` once with a regexp and want slightly shorter syntax for it

```js
var randexp = require('randexp').randexp;

randexp(/[1-6]/); // 4
randexp('great|good( job)?|excellent'); // great
```

If you miss the old syntax

```js
require('randexp').sugar();

/yes|no|maybe|i don't know/.gen(); // maybe
```

# Motivation

Regular expressions are used in every language, every programmer is familiar with them. Regex can be used to easily express complex strings. What better way to generate a random string than with a language you can use to express the string you want?

Thanks to [String-Random](http://search.cpan.org/~steve/String-Random-0.22/lib/String/Random.pm) for giving me the idea to make this in the first place and [randexp](https://github.com/benburkert/randexp) for the sweet `.gen()` syntax.

# Default Range

The default generated character range includes printable ASCII.  In order to add or remove characters,
a `defaultRange` attribute is exposed. you can `subtract(from, to)` and `add(from, to)`
```js
var randexp = new RandExp(/random stuff: .+/);
randexp.defaultRange.subtract(32, 126);
randexp.defaultRange.add(0, 65535);
randexp.gen();
// => random stuff: 湐箻ໜ䫴␩⶛㳸長���邓蕲뤀쑡篷皇硬剈궦佔칗븛뀃匫鴔事좍ﯣ⭼ꝏ䭍詳蒂䥂뽭
```

# Custom PRNG

The default randomness is provided by `Math.random()`. If you need to use a seedable or cryptographic PRNG, you
can override `RandExp.prototype.randInt` or `randexp.randInt` (where `randexp` is an instance of `RandExp`). `randInt(from, to)` accepts an inclusive range and returns a randomly selected
number within that range.

# Infinite Repetitionals

Repetitional tokens such as `*`, `+`, and `{3,}` have an infinite max range. In this case, randexp looks at its min and adds 100 to it to get a useable max value. If you want to use another int other than 100 you can change the `max` property in `RandExp.prototype` or the RandExp instance.

```js
var randexp = new RandExp(/no{1,}/);
randexp.max = 1000000;
```

With `RandExp.sugar()`

```js
var regexp = /(hi)*/;
regexp.max = 1000000;
```

# Bad Regular Expressions

There are some regular expressions which can never match any string.

* Ones with badly placed positionals such as `/a^/` and `/$c/m`. Randexp will ignore positional tokens.

* Back references to non-existing groups like `/(a)\1\2/`. Randexp will ignore those references, returning an empty string for them. If the group exists only after the reference is used such as in `/\1 (hey)/`, it will too be ignored.

* Custom negated character sets with two sets inside that cancel each other out. Example: `/[^\w\W]/`. If you give this to randexp, it will return an empty string for this set since it can't match anything.


# Projects based on randexp.js


## JSON-Schema Faker

Use generators to populate JSON Schema samples. See: [jsf on github](https://github.com/json-schema-faker/json-schema-faker/) and [jsf demo page](http://json-schema-faker.js.org/).


# Install

### Node.js

    npm install randexp

### Browser

Download the [minified version](https://github.com/fent/randexp.js/releases) from the latest release.


# Tests

Tests are written with [mocha](https://mochajs.org)

```bash
npm test
```


# License

MIT
