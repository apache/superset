# levenary

[![npm-version](https://img.shields.io/npm/v/levenary.svg)](https://www.npmjs.com/package/levenary)
[![github-actions](https://github.com/tanhauhau/levenary/workflows/CI/badge.svg)](https://github.com/tanhauhau/levenary/actions)

> Given a string, A and an array of strings XS, return the string X from XS whose Levenshtein distance from A is minimal.


## Install

```
$ npm install levenary
```


## Usage

```js
import levenary from 'levenary';

levenary('cat', ['cow', 'dog', 'pig']);
//=> 'cow'
```

## Why `levenary`?
1. Based on [leven](https://github.com/sindresorhus/leven), the fastest JS implementation of the [Levenshtein distance algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance)
1. Only 1 API. Simple and clean. If you want more, please use [didyoumean2](https://www.npmjs.com/package/didyoumean2).
1. [Flow](http://flow.org/) and [TypeScript](http://typescriptlang.org/) support.

## Benchmark

```
$ npm run bench
```

```
  311,915 op/s » levenary
   74,030 op/s » didyoumean
  141,423 op/s » didyoumean2
```

