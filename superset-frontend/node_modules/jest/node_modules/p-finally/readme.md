# p-finally [![Build Status](https://travis-ci.org/sindresorhus/p-finally.svg?branch=master)](https://travis-ci.org/sindresorhus/p-finally)

> [`Promise#finally()`](https://github.com/tc39/proposal-promise-finally) [ponyfill](https://ponyfill.com) - Invoked when the promise is settled regardless of outcome

Useful for cleanup.


## Install

```
$ npm install p-finally
```


## Usage

```js
const pFinally = require('p-finally');

const directory = createTempDirectory();

(async () => {
	await pFinally(write(directory), () => {
		cleanup(directory);
	});
});
```


## API

### pFinally(promise, onFinally?)

Returns a `Promise`.

#### onFinally

Type: `Function`

Note: Throwing or returning a rejected promise will reject `promise` with the rejection reason.


## Related

- [p-try](https://github.com/sindresorhus/p-try) - `Promise.try()` ponyfill - Starts a promise chain
- [More…](https://github.com/sindresorhus/promise-fun)


---

<div align="center">
	<b>
		<a href="https://tidelift.com/subscription/pkg/npm-p-finally?utm_source=npm-p-finally&utm_medium=referral&utm_campaign=readme">Get professional support for this package with a Tidelift subscription</a>
	</b>
	<br>
	<sub>
		Tidelift helps make open source sustainable for maintainers while giving companies<br>assurances about security, maintenance, and licensing for their dependencies.
	</sub>
</div>
