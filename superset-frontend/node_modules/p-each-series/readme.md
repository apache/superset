# p-each-series [![Build Status](https://travis-ci.org/sindresorhus/p-each-series.svg?branch=master)](https://travis-ci.org/sindresorhus/p-each-series)

> Iterate over promises serially

Useful as a side-effect iterator. Prefer [`p-map`](https://github.com/sindresorhus/p-map) if you don't need side-effects, as it's concurrent.


## Install

```
$ npm install p-each-series
```


## Usage

```js
const pEachSeries = require('p-each-series');

const keywords = [
	getTopKeyword(), //=> Promise
	'rainbow',
	'pony'
];

const iterator = async element => saveToDiskPromise(element);

(async () => {
	console.log(await pEachSeries(keywords, iterator));
	//=> ['unicorn', 'rainbow', 'pony']
})();
```


## API

### pEachSeries(input, iterator)

Returns a `Promise` that is fulfilled when all promises in `input` and ones returned from `iterator` are fulfilled, or rejects if any of the promises reject. The fulfillment value is the original `input`.

#### input

Type: `Iterable<Promise | unknown>`

Iterated over serially in the `iterator` function.

#### iterator(element, index)

Type: `Function`

Return value is ignored unless it's `Promise`, then it's awaited before continuing with the next iteration.


## Related

- [p-map-series](https://github.com/sindresorhus/p-map-series) - Map over promises serially
- [p-series](https://github.com/sindresorhus/p-series) - Run promise-returning & async functions in series
- [p-pipe](https://github.com/sindresorhus/p-pipe) - Compose promise-returning & async functions into a reusable pipeline
- [p-waterfall](https://github.com/sindresorhus/p-waterfall) - Run promise-returning & async functions in series, each passing its result to the next
- [p-reduce](https://github.com/sindresorhus/p-reduce) - Reduce a list of values using promises into a promise for a value
- [p-map](https://github.com/sindresorhus/p-map) - Map over promises concurrently
- [More…](https://github.com/sindresorhus/promise-fun)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
