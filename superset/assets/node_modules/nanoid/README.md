# Nano ID

<img src="https://ai.github.io/nanoid/logo.svg" align="right"
     alt="Nano ID logo by Anton Lovchikov" width="180" height="94">

A tiny, secure, URL-friendly, unique string ID generator for JavaScript.

* **Small.** 141 bytes (minified and gzipped). No dependencies.
It uses [Size Limit] to control size.
* **Safe.** It uses cryptographically strong random APIs
and tests distribution of symbols.
* **Fast.** It’s 16% faster than UUID.
* **Compact.** It uses a larger alphabet than UUID (`A-Za-z0-9_-`).
So ID size was reduced from 36 to 21 symbols.

```js
var nanoid = require('nanoid')
model.id = nanoid() //=> "V1StGXR8_Z5jdHi6B-myT"
```

The generator supports Node.js, React Native, and [all browsers].

[all browsers]: http://caniuse.com/#feat=getrandomvalues
[Size Limit]:   https://github.com/ai/size-limit

<a href="https://evilmartians.com/?utm_source=nanoid">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>


## Security

*See a good article about random generators theory:
[Secure random values (in Node.js)]*


### Unpredictability

Instead of using the unsafe `Math.random()`, Nano ID uses the `crypto` module
in Node.js and the Web Crypto API in browsers. These modules use unpredictable
hardware random generator.


### Uniformity

`random % alphabet` is a popular mistake to make when coding an ID generator.
The spread will not be even; there will be a lower chance for some symbols
to appear compared to others—so it will reduce the number of tries
when brute-forcing.

Nano ID uses a [better algorithm] and is tested for uniformity.

<img src="img/distribution.png" alt="Nano ID uniformity"
     width="340" height="135">

[Secure random values (in Node.js)]: https://gist.github.com/joepie91/7105003c3b26e65efcea63f3db82dfba
[better algorithm]: https://github.com/ai/nanoid/blob/master/format.js


## Comparison with UUID

Nano ID is quite comparable to UUID v4 (random-based).
It has a similar number of random bits in the ID
(126 in Nano ID and 122 in UUID), so it has a similar collision probability:

> For there to be a one in a billion chance of duplication,
> 103 trillion version 4 IDs must be generated.

There are two main differences between Nano ID and UUID v4:

1. Nano ID uses a bigger alphabet, so a similar number of random bits
   are packed in just 21 symbols instead of 36.
2. Nano ID code is 3 times less than `uuid/v4` package:
   141 bytes instead of 435.


## Benchmark

```rust
$ ./test/benchmark
nanoid                    413,579 ops/sec
nanoid/generate           401,349 ops/sec
uid.sync                  354,882 ops/sec
uuid/v4                   353,836 ops/sec
shortid                    39,152 ops/sec

Async:
nanoid/async               85,168 ops/sec
nanoid/async/generate      81,037 ops/sec
uid                        78,426 ops/sec

Non-secure:
nanoid/non-secure       2,718,186 ops/sec
rndm                    2,544,612 ops/sec
```


## Usage

### Normal

The main module uses URL-friendly symbols (`A-Za-z0-9_-`) and returns an ID
with 21 characters (to have a collision probability similar to UUID v4).

```js
const nanoid = require('nanoid')
model.id = nanoid() //=> "Uakgb_J5m9g-0JDMbcJqLJ"
```

Symbols `-,.()` are not encoded in the URL. If used at the end of a link
they could be identified as a punctuation symbol.

If you want to reduce ID length (and increase collisions probability),
you can pass the length as an argument.

```js
nanoid(10) //=> "IRFa-VaY2b"
```

Don’t forget to check the safety of your ID length
in our [ID collision probability] calculator.

[ID collision probability]: https://zelark.github.io/nano-id-cc/


### React Native

To generate secure random IDs in React Native, you must use
[a native random generator] and asynchronous API:

```js
const generateSecureRandom = require('react-native-securerandom').generateSecureRandom
const format = require('nanoid/async/format')
const url = require('nanoid/url')

async function createUser () {
  user.id = await format(generateSecureRandom, url, 21);
}
```

[a native random generator]: https://github.com/rh389/react-native-securerandom


### Web Workers

Web Workers don’t have access to a secure random generator.

Security is important in IDs, when IDs should be unpredictable. For instance,
in “access by URL” link generation.

If you don’t need unpredictable IDs, but you need Web Workers support,
you can use non‑secure ID generator.

```js
const nanoid = require('nanoid/non-secure')
model.id = nanoid() //=> "Uakgb_J5m9g-0JDMbcJqLJ"
```


## Async

To generate hardware random bytes, CPU will collect electromagnetic noise.
During the collection, CPU doesn’t work.

If we will use asynchronous API for random generator,
another code could be executed during the entropy collection.

```js
const nanoid = require('nanoid/async')

async function createUser () {
  user.id = await nanoid()
}
```

Unfortunately, you will not have any benefits in a browser, since Web Crypto API
doesn’t have asynchronous API.


## Custom Alphabet or Length

If you want to change the ID's alphabet or length
you can use the low-level `generate` module.

```js
const generate = require('nanoid/generate')
model.id = generate('1234567890abcdef', 10) //=> "4f90d13a42"
```

Check the safety of your custom alphabet and ID length
in our [ID collision probability] calculator.
You can find popular alphabets in [`nanoid-dictionary`].

Alphabet must contain 256 symbols or less.
Otherwise, the generator will not be secure.

Asynchronous and non-secure API is also available:

```js
const generate = require('nanoid/async/generate')
async function createUser () {
  user.id = await generate('1234567890abcdef', 10)
}
```

```js
const generate = require('nanoid/non-secure/generate')

user.id = generate('1234567890abcdef', 10)
```

[ID collision probability]: https://alex7kom.github.io/nano-nanoid-cc/
[`nanoid-dictionary`]:      https://github.com/CyberAP/nanoid-dictionary


## Custom Random Bytes Generator

You can replace the default safe random generator using the `format` module.
For instance, to use a seed-based generator.

```js
const format = require('nanoid/format')

function random (size) {
  const result = []
  for (let i = 0; i < size; i++) {
    result.push(randomByte())
  }
  return result
}

format(random, "abcdef", 10) //=> "fbaefaadeb"
```

`random` callback must accept the array size and return an array
with random numbers.

If you want to use the same URL-friendly symbols with `format`,
you can get the default alphabet from the `url` file.

```js
const url = require('nanoid/url')
format(random, url, 10) //=> "93ce_Ltuub"
```

Asynchronous API is also available:

```js
const format = require('nanoid/async/format')
const url = require('nanoid/url')

function random (size) {
  return new Promise(…)
}

async function createUser () {
  user.id = await format(random, url, 10)
}
```


## Tools

* [ID size calculator] to choice smaller ID size depends on your case.
* [`nanoid-dictionary`] with popular alphabets to use with `nanoid/generate`.
* [`nanoid-cli`] to generate ID from CLI.
* [`nanoid-good`] to be sure that your ID doesn't contain any obscene words.

[`nanoid-dictionary`]: https://github.com/CyberAP/nanoid-dictionary
[ID size calculator]:  https://zelark.github.io/nano-id-cc/
[`nanoid-cli`]:        https://github.com/twhitbeck/nanoid-cli
[`nanoid-good`]:       https://github.com/y-gagar1n/nanoid-good


## Other Programming Languages

* [C#](https://github.com/codeyu/nanoid-net)
* [Clojure and ClojureScript](https://github.com/zelark/nano-id)
* [Crystal](https://github.com/mamantoha/nanoid.cr)
* [Dart](https://github.com/pd4d10/nanoid)
* [Go](https://github.com/matoous/go-nanoid)
* [Elixir](https://github.com/railsmechanic/nanoid)
* [Haskell](https://github.com/4e6/nanoid-hs)
* [Java](https://github.com/aventrix/jnanoid)
* [Nim](https://github.com/icyphox/nanoid.nim)
* [PHP](https://github.com/hidehalo/nanoid-php)
* [Python](https://github.com/puyuan/py-nanoid)
* [Ruby](https://github.com/radeno/nanoid.rb)
* [Rust](https://github.com/nikolay-govorov/nanoid)
* [Swift](https://github.com/antiflasher/NanoID)

Also, [CLI tool] is available to generate IDs from a command line.

[CLI tool]: https://github.com/twhitbeck/nanoid-cli
