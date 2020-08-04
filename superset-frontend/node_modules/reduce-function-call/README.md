# reduce-function-call [![Build Status](https://travis-ci.org/MoOx/reduce-function-call.svg?branch=master)](https://travis-ci.org/MoOx/reduce-function-call)

> Reduce function calls in a string, using a callback

---

[Professionally supported reduce-function-call is now available](https://tidelift.com/subscription/pkg/npm-reduce-function-call?utm_source=npm-reduce-function-call&utm_medium=referral&utm_campaign=readme)

---

## Installation

```console
npm install reduce-function-call
```

## Usage

```js
var reduceFunctionCall = require("reduce-function-call")

reduceFunctionCall("foo(1)", "foo", function(body) {
  // body === "1"
  return parseInt(body, 10) + 1
})
// "2"

var nothingOrUpper = function(body, functionIdentifier) {
  // ignore empty value
  if (body === "") {
    return functionIdentifier + "()"
  }

  return body.toUpperCase()
}

reduceFunctionCall("bar()", "bar", nothingOrUpper)
// "bar()"

reduceFunctionCall("upper(baz)", "upper", nothingOrUpper)
// "BAZ"

reduceFunctionCall("math(math(2 + 2) * 4 + math(2 + 2)) and other things", "math", function(body, functionIdentifier, call) {
  try {
    return eval(body)
  }
  catch (e) {
    return call
  }
})
// "20 and other things"

reduceFunctionCall("sha bla blah() blaa bla() abla() aabla() blaaa()", /\b([a-z]?bla[a-z]?)\(/, function(body, functionIdentifier) {
  if (functionIdentifier === "bla") {
    return "ABRACADABRA"
  }
  return functionIdentifier.replace("bla", "!")
}
// "sha bla !h blaa ABRACADABRA a! aabla() blaaa()"
```

See [unit tests](test/index.js) for others examples.

## Contributing

Work on a branch, install dev-dependencies, respect coding style & run tests before submitting a bug fix or a feature.

```console
git clone https://github.com/MoOx/reduce-function-call.git
git checkout -b patch-1
npm install
npm test
```

---

## [Changelog](CHANGELOG.md)

## [License](LICENSE)

---

## Security contact information

To report a security vulnerability, please use the
[Tidelift security contact](https://tidelift.com/security). Tidelift will
coordinate the fix and disclosure.

